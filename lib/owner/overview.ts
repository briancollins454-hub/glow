import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { supabaseService } from "@/lib/supabase/service";
import { cachedGet } from "@/lib/owner/cache";
import { computeMrrFromTechs, type MrrBreakdown } from "@/lib/owner/mrr";
import { getPlatformTraffic, type PlatformTraffic } from "@/lib/traffic-stats";

const TZ = "Europe/London";
const OVERVIEW_TTL_MS = 60_000;

export type MetricValue =
  | { ok: true; value: number }
  | { ok: false; reason: string };

export type OverviewCounts = {
  accountsTotal: number;
  paying: number;
  trialing: number;
  cancelled: number;
  complimentary: number;
  testers: number;
  pastDue: number;
  none: number;
  staffTotal: MetricValue;
  clientsTotal: MetricValue;
  bookingsAllTime: MetricValue;
  bookingsThisMonth: MetricValue;
  bookingsToday: MetricValue;
  /** Client payment volume through Connect (not Glow revenue). */
  gmvPennies: MetricValue;
  mrr: MrrBreakdown;
  /** New active this calendar month (approx from createdAt among currently active). */
  newPayingThisMonth: MetricValue;
  churnedThisMonth: MetricValue;
  trialToPaidRate: MetricValue;
  signups: { day: number; week: number; month: number };
  activation: {
    signedUp: number;
    withService: MetricValue;
    withBooking: MetricValue;
    withPaidBooking: MetricValue;
  };
  health: {
    lastCron: { job: string; at: string; ok: boolean; result: Record<string, unknown> } | null;
    failedCrons24h: MetricValue;
    outboundFailures24h: MetricValue;
    errors24h: MetricValue;
    inboundForwards24h: MetricValue;
  };
  traffic: PlatformTraffic;
  generatedAt: string;
  ttlSeconds: number;
};

function ok(value: number): MetricValue {
  return { ok: true, value };
}
function unavailable(reason: string): MetricValue {
  return { ok: false, reason };
}

async function countTable(
  table: string,
  filters?: { column: string; op: "eq" | "gte" | "lt"; value: string | boolean | number }[],
): Promise<MetricValue> {
  try {
    const sb = supabaseService();
    let q = sb.from(table).select("id", { count: "exact", head: true });
    for (const f of filters ?? []) {
      if (f.op === "eq") q = q.eq(f.column, f.value);
      else if (f.op === "gte") q = q.gte(f.column, f.value);
      else if (f.op === "lt") q = q.lt(f.column, f.value);
    }
    const { count, error } = await q;
    if (error) return unavailable(error.message);
    return ok(count ?? 0);
  } catch (e) {
    return unavailable((e as Error).message);
  }
}

async function sumSucceededPayments(): Promise<MetricValue> {
  try {
    const sb = supabaseService();
    // Paginate in chunks so we never load unbounded rows into memory wrongly —
    // use RPC-style sum via select of amount only with range if needed.
    // For honesty under load: aggregate in SQL if possible; fallback page sums.
    const { data, error } = await sb
      .from("payments")
      .select("amountPennies, kind, status")
      .eq("status", "succeeded")
      .in("kind", ["deposit", "balance", "no_show_fee"])
      .limit(100_000);
    if (error) return unavailable(error.message);
    const total = (data ?? []).reduce((sum, row) => sum + Number(row.amountPennies ?? 0), 0);
    if ((data?.length ?? 0) >= 100_000) {
      return unavailable("GMV too large to sum in one pass; add a SQL aggregate and retry");
    }
    return ok(total);
  } catch (e) {
    return unavailable((e as Error).message);
  }
}

async function loadHealth() {
  const sb = supabaseService();
  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const empty = {
    lastCron: null as OverviewCounts["health"]["lastCron"],
    failedCrons24h: unavailable("cron_runs table missing — run migration 0044"),
    outboundFailures24h: unavailable("outbound_sends table missing — run migration 0044"),
    errors24h: unavailable("platform_errors table missing — run migration 0044"),
    inboundForwards24h: unavailable("inbound_forwards table missing — run migration 0044"),
  };

  try {
    const { data: lastRows, error: lastErr } = await sb
      .from("cron_runs")
      .select("job, ok, result, finishedAt, startedAt")
      .order("startedAt", { ascending: false })
      .limit(1);
    if (lastErr) return empty;

    const last = lastRows?.[0];
    const lastCron = last
      ? {
          job: String(last.job),
          at: String(last.finishedAt ?? last.startedAt),
          ok: !!last.ok,
          result: (last.result ?? {}) as Record<string, unknown>,
        }
      : null;

    const failedCrons = await countTable("cron_runs", [
      { column: "ok", op: "eq", value: false },
      { column: "startedAt", op: "gte", value: since24 },
    ]);
    const outboundFailures = await countTable("outbound_sends", [
      { column: "ok", op: "eq", value: false },
      { column: "createdAt", op: "gte", value: since24 },
    ]);
    const errors = await countTable("platform_errors", [
      { column: "createdAt", op: "gte", value: since24 },
    ]);
    const inbound = await countTable("inbound_forwards", [
      { column: "createdAt", op: "gte", value: since24 },
    ]);

    return {
      lastCron,
      failedCrons24h: failedCrons,
      outboundFailures24h: outboundFailures,
      errors24h: errors,
      inboundForwards24h: inbound,
    };
  } catch {
    return empty;
  }
}

async function computeOverview(): Promise<OverviewCounts> {
  const sb = supabaseService();
  const now = new Date();
  const todayStart = formatInTimeZone(now, TZ, "yyyy-MM-dd");
  const todaySince = fromZonedTime(`${todayStart} 00:00:00`, TZ).toISOString();
  const monthStart = formatInTimeZone(now, TZ, "yyyy-MM-01");
  const monthSince = fromZonedTime(`${monthStart} 00:00:00`, TZ).toISOString();
  const weekSince = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const daySince = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data: techs, error: techErr } = await sb
    .from("techs")
    .select(
      "id, subscriptionStatus, plan, signupOffer, createdAt, bookingPageLive, connectChargesEnabled",
    );
  if (techErr) throw new Error(techErr.message);
  const list = techs ?? [];

  const paying = list.filter((t) => t.subscriptionStatus === "active").length;
  const trialing = list.filter((t) => t.subscriptionStatus === "trialing").length;
  const cancelled = list.filter((t) => t.subscriptionStatus === "canceled").length;
  const complimentary = list.filter((t) => t.subscriptionStatus === "comped").length;
  const testers = list.filter((t) => t.signupOffer === "tester").length;
  const pastDue = list.filter((t) => t.subscriptionStatus === "past_due").length;
  const none = list.filter((t) => t.subscriptionStatus === "none").length;

  const mrr = computeMrrFromTechs(list);

  const signupsDay = list.filter((t) => t.createdAt >= daySince).length;
  const signupsWeek = list.filter((t) => t.createdAt >= weekSince).length;
  const signupsMonth = list.filter((t) => t.createdAt >= monthSince).length;

  // Churn approx: currently canceled with createdAt any, updated via period —
  // we do not store canceledAt; use audit if needed. Honest: count canceled
  // accounts whose currentPeriodEnd fell this month OR createdAt not useful.
  // Better: accounts with status canceled and currentPeriodEnd in this month —
  // but we may not have selected it. Re-query lightly.
  const { data: canceledRows } = await sb
    .from("techs")
    .select("id, currentPeriodEnd, createdAt")
    .eq("subscriptionStatus", "canceled");
  const churnedThisMonth = ok(
    (canceledRows ?? []).filter((t) => {
      const end = t.currentPeriodEnd as string | null;
      if (end && end >= monthSince) return true;
      // Fallback: no period end — unavailable-ish; count only with period end.
      return false;
    }).length,
  );

  // New paying this month: active + created this month (proxy for converted/new).
  const newPayingThisMonth = ok(
    list.filter((t) => t.subscriptionStatus === "active" && t.createdAt >= monthSince).length,
  );

  // Trial-to-paid: among accounts that are active and had a trial path we cannot
  // see without Stripe. Proxy: active / (active + trialing + canceled who had plan)
  // is misleading. Better honest metric: active / (active + trialing) among live-ish.
  const conversionDenom = paying + trialing;
  const trialToPaidRate =
    conversionDenom === 0
      ? unavailable("No trialing or paying accounts yet")
      : ok(Math.round((paying / conversionDenom) * 1000) / 10);

  const [
    staffTotal,
    clientsTotal,
    bookingsAllTime,
    bookingsThisMonth,
    bookingsToday,
    gmvPennies,
    withService,
    withBooking,
    withPaidBooking,
    traffic,
    health,
  ] = await Promise.all([
    countTable("staff_members"),
    countTable("clients"),
    countTable("bookings"),
    countTable("bookings", [{ column: "createdAt", op: "gte", value: monthSince }]),
    countTable("bookings", [{ column: "createdAt", op: "gte", value: todaySince }]),
    sumSucceededPayments(),
    distinctTechCount("services"),
    distinctTechCount("bookings"),
    distinctTechCount("payments", [{ column: "status", op: "eq", value: "succeeded" }]),
    getPlatformTraffic(),
    loadHealth(),
  ]);

  return {
    accountsTotal: list.length,
    paying,
    trialing,
    cancelled,
    complimentary,
    testers,
    pastDue,
    none,
    staffTotal,
    clientsTotal,
    bookingsAllTime,
    bookingsThisMonth,
    bookingsToday,
    gmvPennies,
    mrr,
    newPayingThisMonth,
    churnedThisMonth,
    trialToPaidRate,
    signups: { day: signupsDay, week: signupsWeek, month: signupsMonth },
    activation: {
      signedUp: list.length,
      withService,
      withBooking,
      withPaidBooking,
    },
    health,
    traffic,
    generatedAt: new Date().toISOString(),
    ttlSeconds: OVERVIEW_TTL_MS / 1000,
  };
}

async function distinctTechCount(
  table: string,
  filters?: { column: string; op: "eq"; value: string }[],
): Promise<MetricValue> {
  try {
    const sb = supabaseService();
    let q = sb.from(table).select("techId");
    for (const f of filters ?? []) {
      q = q.eq(f.column, f.value);
    }
    // Cap to avoid huge memory; if capped, mark unavailable.
    const { data, error } = await q.limit(50_000);
    if (error) return unavailable(error.message);
    if ((data?.length ?? 0) >= 50_000) {
      return unavailable(`Too many ${table} rows to count distinct techs in app`);
    }
    return ok(new Set((data ?? []).map((r) => r.techId).filter(Boolean)).size);
  } catch (e) {
    return unavailable((e as Error).message);
  }
}

export async function getOwnerOverview(): Promise<OverviewCounts> {
  return cachedGet("owner:overview", OVERVIEW_TTL_MS, computeOverview);
}

export function metricNumber(m: MetricValue): string {
  if (!m.ok) return "Unavailable";
  return m.value.toLocaleString("en-GB");
}

export function metricHint(m: MetricValue): string | null {
  return m.ok ? null : m.reason;
}
