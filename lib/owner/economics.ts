/**
 * Unit economics (Phase 2.5) — cost per account, margin, SMS top consumers.
 */

import { randomId } from "@/lib/ids";
import { supabaseService } from "@/lib/supabase/service";
import { filterOutInternal, shouldIncludeInternal } from "@/lib/owner/internal-accounts";
import { LIST_MONTHLY_PENNIES, planMrrPennies } from "@/lib/owner/mrr";
import type { Tech } from "@/lib/db/types";

export type CostRecord = {
  id: string;
  periodMonth: string;
  provider: "supabase" | "resend" | "twilio" | "vercel" | "stripe";
  amountPennies: number;
  notes: string;
  enteredBy: string;
  createdAt: string;
};

export type AccountEconomics = {
  techId: string;
  label: string;
  handle: string;
  revenuePennies: number;
  allocableSharePennies: number;
  attributablePennies: number;
  totalCostPennies: number;
  marginPennies: number;
  smsCostPennies: number;
  emailCount: number;
  flagged: boolean;
};

export type EconomicsSnapshot = {
  periodMonth: string;
  costs: CostRecord[];
  platformCostPennies: number;
  payingAccounts: number;
  allocablePerAccountPennies: number;
  accounts: AccountEconomics[];
  topSms: { techId: string; label: string; messageCount: number; costPennies: number }[];
  warnPercent: number;
  marginTrend: { month: string; revenuePennies: number; costPennies: number; marginPennies: number }[];
  note: string;
};

export function currentPeriodMonth(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Pure arithmetic used by tests. */
export function computeAccountMargin(opts: {
  revenuePennies: number;
  allocableSharePennies: number;
  attributablePennies: number;
  warnPercent: number;
}): { totalCostPennies: number; marginPennies: number; flagged: boolean } {
  const totalCostPennies = opts.allocableSharePennies + opts.attributablePennies;
  const marginPennies = opts.revenuePennies - totalCostPennies;
  const share =
    opts.revenuePennies > 0 ? (opts.attributablePennies / opts.revenuePennies) * 100 : 0;
  return {
    totalCostPennies,
    marginPennies,
    flagged: opts.revenuePennies > 0 && share >= opts.warnPercent,
  };
}

export async function getCostWarnPercent(): Promise<number> {
  try {
    const { data } = await supabaseService()
      .from("owner_settings")
      .select("value")
      .eq("key", "costShareWarnPercent")
      .maybeSingle();
    const pct = (data as { value?: { percent?: number } } | null)?.value?.percent;
    return typeof pct === "number" ? pct : 40;
  } catch {
    return 40;
  }
}

export async function listCostRecords(periodMonth?: string): Promise<CostRecord[]> {
  let q = supabaseService()
    .from("cost_records")
    .select("*")
    .order("createdAt", { ascending: false });
  if (periodMonth) q = q.eq("periodMonth", periodMonth);
  const { data } = await q.limit(200);
  return (data ?? []) as CostRecord[];
}

export async function addCostRecord(opts: {
  periodMonth: string;
  provider: CostRecord["provider"];
  amountPennies: number;
  notes: string;
  enteredBy: string;
}): Promise<void> {
  await supabaseService().from("cost_records").insert({
    id: randomId("cost"),
    periodMonth: opts.periodMonth,
    provider: opts.provider,
    amountPennies: opts.amountPennies,
    notes: opts.notes,
    enteredBy: opts.enteredBy,
    createdAt: new Date().toISOString(),
  });
}

/** Aggregate sms_usage for a month from outbound_sends (approx £0.04/msg = 4p). */
export async function rollupSmsUsage(periodMonth: string): Promise<number> {
  const sb = supabaseService();
  const [y, m] = periodMonth.split("-").map(Number);
  const start = new Date(Date.UTC(y!, m! - 1, 1)).toISOString();
  const end = new Date(Date.UTC(y!, m!, 1)).toISOString();
  const { data } = await sb
    .from("outbound_sends")
    .select("techId")
    .eq("channel", "sms")
    .eq("ok", true)
    .gte("createdAt", start)
    .lt("createdAt", end)
    .limit(20000);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.techId) continue;
    counts.set(row.techId, (counts.get(row.techId) ?? 0) + 1);
  }
  let written = 0;
  for (const [techId, messageCount] of counts) {
    const costPennies = messageCount * 4;
    await sb.from("sms_usage").upsert(
      {
        id: `smsu_${techId}_${periodMonth}`,
        techId,
        messageCount,
        costPennies,
        periodMonth,
      },
      { onConflict: "techId,periodMonth" },
    );
    written++;
  }
  return written;
}

export async function getEconomicsSnapshot(periodMonth?: string): Promise<EconomicsSnapshot> {
  const month = periodMonth ?? currentPeriodMonth();
  const sb = supabaseService();
  const includeInternal = await shouldIncludeInternal(sb);
  const warnPercent = await getCostWarnPercent();
  const costs = await listCostRecords(month);
  const platformCostPennies = costs.reduce((s, c) => s + c.amountPennies, 0);

  const { data: techsRaw } = await sb
    .from("techs")
    .select("id, businessName, handle, email, subscriptionStatus, plan, isInternal")
    .limit(5000);
  const techs = filterOutInternal((techsRaw ?? []) as Tech[], includeInternal);
  const paying = techs.filter((t) => t.subscriptionStatus === "active");
  const allocablePerAccountPennies =
    paying.length > 0 ? Math.round(platformCostPennies / paying.length) : platformCostPennies;

  const { data: smsRows } = await sb.from("sms_usage").select("*").eq("periodMonth", month);
  const smsByTech = new Map(
    (smsRows ?? []).map((r) => [r.techId as string, r as { messageCount: number; costPennies: number }]),
  );

  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y!, m! - 1, 1)).toISOString();
  const end = new Date(Date.UTC(y!, m!, 1)).toISOString();

  const accounts: AccountEconomics[] = [];
  for (const tech of paying) {
    const sms = smsByTech.get(tech.id);
    const { count: emailCount } = await sb
      .from("outbound_sends")
      .select("id", { count: "exact", head: true })
      .eq("techId", tech.id)
      .eq("channel", "email")
      .gte("createdAt", start)
      .lt("createdAt", end);
    // Email cost proxy: 0.1p each (Resend-ish) — attributable only
    const emailCost = Math.round((emailCount ?? 0) * 0.1);
    const attributablePennies = (sms?.costPennies ?? 0) + emailCost;
    const revenuePennies = planMrrPennies(tech.plan) || LIST_MONTHLY_PENNIES;
    const calc = computeAccountMargin({
      revenuePennies,
      allocableSharePennies: allocablePerAccountPennies,
      attributablePennies,
      warnPercent,
    });
    accounts.push({
      techId: tech.id,
      label: tech.businessName || tech.handle,
      handle: tech.handle,
      revenuePennies,
      allocableSharePennies: allocablePerAccountPennies,
      attributablePennies,
      totalCostPennies: calc.totalCostPennies,
      marginPennies: calc.marginPennies,
      smsCostPennies: sms?.costPennies ?? 0,
      emailCount: emailCount ?? 0,
      flagged: calc.flagged,
    });
  }
  accounts.sort((a, b) => a.marginPennies - b.marginPennies);

  const topSms = [...smsByTech.entries()]
    .map(([techId, r]) => {
      const t = techs.find((x) => x.id === techId);
      return {
        techId,
        label: t?.businessName || t?.handle || techId,
        messageCount: r.messageCount,
        costPennies: r.costPennies,
      };
    })
    .sort((a, b) => b.costPennies - a.costPennies)
    .slice(0, 20);

  // Margin trend: last 6 months of cost_records vs list MRR * paying (approx)
  const { data: allCosts } = await sb.from("cost_records").select("periodMonth, amountPennies").limit(500);
  const byMonth = new Map<string, number>();
  for (const c of allCosts ?? []) {
    byMonth.set(c.periodMonth, (byMonth.get(c.periodMonth) ?? 0) + c.amountPennies);
  }
  const months = [...byMonth.keys()].sort().slice(-6);
  const revenueNow = paying.reduce(
    (s, t) => s + (planMrrPennies(t.plan) || LIST_MONTHLY_PENNIES),
    0,
  );
  const marginTrend = months.map((mo) => {
    const costPennies = byMonth.get(mo) ?? 0;
    return {
      month: mo,
      revenuePennies: revenueNow,
      costPennies,
      marginPennies: revenueNow - costPennies,
    };
  });

  return {
    periodMonth: month,
    costs,
    platformCostPennies,
    payingAccounts: paying.length,
    allocablePerAccountPennies,
    accounts,
    topSms,
    warnPercent,
    marginTrend,
    note: "Allocable = platform costs ÷ paying accounts. Attributable = SMS (4p) + email proxy (0.1p). Enter costs monthly for truthful margins.",
  };
}
