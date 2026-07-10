import type { SupabaseClient } from "@supabase/supabase-js";
import { dueReminders, getBooking, markReminder } from "@/lib/db/queries";
import { sendReminder } from "@/lib/notify";

// Processes reminders whose send time has passed. Called by the Vercel Cron
// route and the "run now" dashboard button. Uses the service-role client.
export async function processDueReminders(
  sb: SupabaseClient,
  nowIso = new Date().toISOString(),
): Promise<{ sent: number; skipped: number; checkinsSent?: number; checkinsSkipped?: number }> {
  const due = await dueReminders(sb, nowIso);
  let sent = 0;
  let skipped = 0;

  for (const reminder of due) {
    if (reminder.kind === "patch_test_retest") {
      await markReminder(sb, reminder.id, { status: "skipped" });
      skipped++;
      continue;
    }
    const booking = reminder.bookingId ? await getBooking(sb, reminder.bookingId) : null;
    if (!booking || booking.status === "cancelled" || booking.status === "no_show") {
      await markReminder(sb, reminder.id, { status: "skipped" });
      skipped++;
      continue;
    }
    if (reminder.kind === "balance_request" && booking.balanceStatus === "paid") {
      await markReminder(sb, reminder.id, { status: "skipped" });
      skipped++;
      continue;
    }
    await sendReminder(sb, reminder);
    sent++;
  }

  let checkinsSent = 0;
  let checkinsSkipped = 0;
  try {
    const { processDueReactionCheckins } = await import("@/lib/reaction-checkin");
    const checkins = await processDueReactionCheckins(sb, nowIso);
    checkinsSent = checkins.sent;
    checkinsSkipped = checkins.skipped;
  } catch {
    // Migration may be pending.
  }

  return { sent, skipped, checkinsSent, checkinsSkipped };
}
