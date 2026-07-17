import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/service";
import { processDueReminders } from "@/lib/scheduler";
import { processDueOnboardingEmails } from "@/lib/onboarding";
import { reportError } from "@/lib/monitor";

// Per-instance throttle for auth-failure alerts (serverless instances each keep
// their own timestamp). Stops a missing/bad CRON_SECRET from emailing every 15m.
const AUTH_ALERT_WINDOW_MS = 60 * 60 * 1000;
let lastAuthAlertAt = 0;

async function alertAuthFailure(message: string): Promise<void> {
  const now = Date.now();
  if (now - lastAuthAlertAt < AUTH_ALERT_WINDOW_MS) return;
  lastAuthAlertAt = now;
  await reportError(new Error(message), { route: "/api/cron/reminders" });
}

// Triggered by Vercel Cron (see vercel.json). Uses the service-role client so it
// can process reminders across all techs.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    await alertAuthFailure("reminders cron rejected: CRON_SECRET missing");
    return NextResponse.json({ error: "cron not configured" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    await alertAuthFailure("reminders cron rejected: bad bearer token");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = supabaseService();
  const result = await processDueReminders(sb);
  let onboarding = 0;
  try {
    onboarding = await processDueOnboardingEmails(sb);
  } catch (err) {
    console.error("[cron] onboarding emails failed:", (err as Error).message);
    await reportError(err, { route: "/api/cron/reminders", section: "onboarding" });
  }
  let rebookNudges = 0;
  try {
    const { processRebookNudges } = await import("@/lib/rebooking");
    rebookNudges = await processRebookNudges(sb);
  } catch (err) {
    console.error("[cron] rebook nudges failed:", (err as Error).message);
    await reportError(err, { route: "/api/cron/reminders", section: "rebooking" });
  }
  let infillNudges = { sent: 0, skipped: 0 };
  try {
    const { processInfillDeadlineNudges } = await import("@/lib/infill-nudge");
    infillNudges = await processInfillDeadlineNudges(sb);
  } catch (err) {
    console.error("[cron] infill deadline nudges failed:", (err as Error).message);
    await reportError(err, { route: "/api/cron/reminders", section: "infill" });
  }
  return NextResponse.json({ ok: true, ...result, onboarding, rebookNudges, infillNudges, at: new Date().toISOString() });
}
