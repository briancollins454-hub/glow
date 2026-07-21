import { randomId } from "@/lib/ids";
import { supabaseService } from "@/lib/supabase/service";
import { processDueReminders } from "@/lib/scheduler";

export type CronRunRow = {
  id: string;
  job: string;
  trigger: string;
  ok: boolean;
  result: Record<string, unknown>;
  error: string | null;
  durationMs: number | null;
  startedAt: string;
  finishedAt: string | null;
};

export async function listCronRuns(limit = 40): Promise<CronRunRow[]> {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("cron_runs")
    .select("*")
    .order("startedAt", { ascending: false })
    .limit(limit);
  if (error) {
    // Table may not exist until migration 0044.
    return [];
  }
  return (data ?? []) as CronRunRow[];
}

export async function listPlatformErrors(limit = 50) {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("platform_errors")
    .select("*")
    .order("createdAt", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}

export async function listOutboundSends(limit = 50) {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("outbound_sends")
    .select("*")
    .order("createdAt", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}

export async function recordCronRun(opts: {
  job: string;
  trigger: "cron" | "manual";
  ok: boolean;
  result?: Record<string, unknown>;
  error?: string | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}): Promise<void> {
  try {
    await supabaseService()
      .from("cron_runs")
      .insert({
        id: randomId("cron"),
        job: opts.job,
        trigger: opts.trigger,
        ok: opts.ok,
        result: opts.result ?? {},
        error: opts.error ?? null,
        durationMs: opts.durationMs,
        startedAt: opts.startedAt,
        finishedAt: opts.finishedAt,
      });
  } catch {
    // Migration may be pending.
  }
}

/** Run the same work as Vercel cron (reminders + onboarding + rebook + infill). */
export async function runRemindersJobNow(trigger: "cron" | "manual" = "manual") {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const sb = supabaseService();
  try {
    const result = await processDueReminders(sb);
    let onboarding = 0;
    try {
      const { processDueOnboardingEmails } = await import("@/lib/onboarding");
      onboarding = await processDueOnboardingEmails(sb);
    } catch (err) {
      console.error("[owner cron] onboarding failed:", (err as Error).message);
    }
    let rebookNudges = 0;
    try {
      const { processRebookNudges } = await import("@/lib/rebooking");
      rebookNudges = await processRebookNudges(sb);
    } catch (err) {
      console.error("[owner cron] rebook failed:", (err as Error).message);
    }
    let infillNudges = { sent: 0, skipped: 0 };
    try {
      const { processInfillDeadlineNudges } = await import("@/lib/infill-nudge");
      infillNudges = await processInfillDeadlineNudges(sb);
    } catch (err) {
      console.error("[owner cron] infill failed:", (err as Error).message);
    }
    const finishedAt = new Date().toISOString();
    const payload = { ...result, onboarding, rebookNudges, infillNudges };
    await recordCronRun({
      job: "reminders",
      trigger,
      ok: true,
      result: payload,
      startedAt,
      finishedAt,
      durationMs: Date.now() - t0,
    });
    return { ok: true as const, ...payload, at: finishedAt };
  } catch (e) {
    const finishedAt = new Date().toISOString();
    await recordCronRun({
      job: "reminders",
      trigger,
      ok: false,
      error: (e as Error).message,
      startedAt,
      finishedAt,
      durationMs: Date.now() - t0,
    });
    return { ok: false as const, error: (e as Error).message, at: finishedAt };
  }
}

export type IntegrityFinding = {
  check: string;
  count: number;
  sample: Record<string, unknown>[];
  fixable: boolean;
  note: string;
};

export async function runIntegrityChecks(): Promise<IntegrityFinding[]> {
  const sb = supabaseService();
  const findings: IntegrityFinding[] = [];

  // Bookings with missing client
  {
    const { data } = await sb
      .from("bookings")
      .select("id, techId, clientId, startIso, status")
      .is("clientId", null)
      .limit(25);
    const rows = data ?? [];
    findings.push({
      check: "bookings_missing_client",
      count: rows.length,
      sample: rows,
      fixable: false,
      note: "Bookings with null clientId. Manual review only.",
    });
  }

  // Payments with missing booking
  {
    const { data: pays } = await sb.from("payments").select("id, techId, bookingId").limit(500);
    const bookingIds = [...new Set((pays ?? []).map((p) => p.bookingId).filter(Boolean))];
    const existing = new Set<string>();
    // chunk
    for (let i = 0; i < bookingIds.length; i += 100) {
      const slice = bookingIds.slice(i, i + 100);
      const { data } = await sb.from("bookings").select("id").in("id", slice);
      for (const b of data ?? []) existing.add(b.id);
    }
    const orphanPays = (pays ?? []).filter((p) => p.bookingId && !existing.has(p.bookingId));
    findings.push({
      check: "payments_orphaned_booking",
      count: orphanPays.length,
      sample: orphanPays.slice(0, 25) as Record<string, unknown>[],
      fixable: false,
      note: "Payments whose bookingId no longer exists.",
    });
  }

  // Malformed client names (digits)
  {
    const { data } = await sb.from("clients").select("id, techId, name, phone").limit(2000);
    const bad = (data ?? []).filter((c) => {
      const name = String(c.name ?? "");
      if (!name.trim()) return true;
      return (name.match(/\d/g) ?? []).length >= 6;
    });
    findings.push({
      check: "malformed_client_names",
      count: bad.length,
      sample: bad.slice(0, 25) as Record<string, unknown>[],
      fixable: true,
      note: "Use Client name cleanup under Owner tools. Blank or digit-heavy names.",
    });
  }

  // Connect pending among live accounts
  {
    const { data } = await sb
      .from("techs")
      .select("id, businessName, handle, email, subscriptionStatus, connectChargesEnabled, connectDetailsSubmitted")
      .in("subscriptionStatus", ["trialing", "active", "comped"])
      .eq("connectChargesEnabled", false)
      .limit(50);
    findings.push({
      check: "connect_pending",
      count: (data ?? []).length,
      sample: (data ?? []) as Record<string, unknown>[],
      fixable: false,
      note: "Live accounts that cannot take card payments yet.",
    });
  }

  return findings;
}
