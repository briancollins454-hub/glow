import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/service";
import { processDueReminders } from "@/lib/scheduler";
import { processDueOnboardingEmails } from "@/lib/onboarding";

// Triggered by Vercel Cron (see vercel.json). Uses the service-role client so it
// can process reminders across all techs.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const sb = supabaseService();
  const result = await processDueReminders(sb);
  let onboarding = 0;
  try {
    onboarding = await processDueOnboardingEmails(sb);
  } catch (err) {
    console.error("[cron] onboarding emails failed:", (err as Error).message);
  }
  let rebookNudges = 0;
  try {
    const { processRebookNudges } = await import("@/lib/rebooking");
    rebookNudges = await processRebookNudges(sb);
  } catch (err) {
    console.error("[cron] rebook nudges failed:", (err as Error).message);
  }
  return NextResponse.json({ ok: true, ...result, onboarding, rebookNudges, at: new Date().toISOString() });
}
