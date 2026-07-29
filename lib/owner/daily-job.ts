/**
 * Daily owner console job: health scores, snapshots, SMS usage rollup.
 * Respects owner_settings.cronPaused when present.
 */

import { supabaseService } from "@/lib/supabase/service";
import { recordCronRun } from "@/lib/owner/ops";
import { runHealthAndSnapshotJob } from "@/lib/owner/health";
import { currentPeriodMonth, rollupSmsUsage } from "@/lib/owner/economics";

async function isCronPaused(): Promise<boolean> {
  try {
    const { data } = await supabaseService()
      .from("owner_settings")
      .select("value")
      .eq("key", "cronPaused")
      .maybeSingle();
    return !!(data as { value?: { paused?: boolean } } | null)?.value?.paused;
  } catch {
    return false;
  }
}

export async function runOwnerDailyJob(
  trigger: "cron" | "manual" = "manual",
  opts?: { limit?: number },
) {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  if (await isCronPaused()) {
    const finishedAt = new Date().toISOString();
    await recordCronRun({
      job: "owner_daily",
      trigger,
      ok: true,
      result: { skipped: true, reason: "cronPaused" },
      startedAt,
      finishedAt,
      durationMs: Date.now() - t0,
    });
    return { ok: true as const, skipped: true as const, reason: "cronPaused" };
  }

  try {
    // Manual runs stay inside serverless limits; cron can score more accounts.
    const limit = opts?.limit ?? (trigger === "manual" ? 200 : 500);
    const health = await runHealthAndSnapshotJob({ limit });
    let smsRows = 0;
    try {
      smsRows = await rollupSmsUsage(currentPeriodMonth());
    } catch (err) {
      console.error("[owner daily] sms rollup failed:", (err as Error).message);
    }
    let alertsCreated = 0;
    try {
      const { evaluateAnomalyAlerts } = await import("@/lib/owner/alerts");
      alertsCreated = (await evaluateAnomalyAlerts()).created;
    } catch (err) {
      console.error("[owner daily] alerts failed:", (err as Error).message);
    }
    const finishedAt = new Date().toISOString();
    const result = {
      health,
      smsRows,
      alertsCreated,
      periodMonth: currentPeriodMonth(),
      limit,
      durationMs: Date.now() - t0,
    };
    await recordCronRun({
      job: "owner_daily",
      trigger,
      ok: true,
      result,
      startedAt,
      finishedAt,
      durationMs: Date.now() - t0,
    });
    return { ok: true as const, ...result };
  } catch (err) {
    const finishedAt = new Date().toISOString();
    const message = (err as Error).message || "owner daily failed";
    console.error("[owner daily]", message);
    await recordCronRun({
      job: "owner_daily",
      trigger,
      ok: false,
      error: message,
      startedAt,
      finishedAt,
      durationMs: Date.now() - t0,
    });
    return { ok: false as const, error: message };
  }
}
