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

export async function runOwnerDailyJob(trigger: "cron" | "manual" = "manual") {
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
    return { ok: true as const, skipped: true, reason: "cronPaused" };
  }

  try {
    const health = await runHealthAndSnapshotJob();
    const smsRows = await rollupSmsUsage(currentPeriodMonth());
    const finishedAt = new Date().toISOString();
    const result = { health, smsRows, periodMonth: currentPeriodMonth() };
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
    await recordCronRun({
      job: "owner_daily",
      trigger,
      ok: false,
      error: (err as Error).message,
      startedAt,
      finishedAt,
      durationMs: Date.now() - t0,
    });
    return { ok: false as const, error: (err as Error).message };
  }
}
