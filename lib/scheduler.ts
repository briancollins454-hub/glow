import { dueReminders, getBooking, markReminder } from "@/lib/db/repo";
import { sendReminder } from "@/lib/notify";

// Processes all reminders whose send time has passed. Called by the Vercel Cron
// route and by the "run now" button in the dashboard.
export async function processDueReminders(nowMs = Date.now()): Promise<{
  sent: number;
  skipped: number;
}> {
  const due = dueReminders(nowMs);
  let sent = 0;
  let skipped = 0;

  for (const reminder of due) {
    const booking = getBooking(reminder.bookingId);
    // Don't send reminders for cancelled / no-show appointments.
    if (!booking || booking.status === "cancelled" || booking.status === "no_show") {
      markReminder(reminder.id, { status: "skipped" });
      skipped++;
      continue;
    }
    // Skip balance requests once the balance is settled.
    if (reminder.kind === "balance_request" && booking.balanceStatus === "paid") {
      markReminder(reminder.id, { status: "skipped" });
      skipped++;
      continue;
    }
    await sendReminder(reminder);
    sent++;
  }

  return { sent, skipped };
}
