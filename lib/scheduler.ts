import type { SupabaseClient } from "@supabase/supabase-js";
import { dueReminders, getBooking, getTechById, markReminder } from "@/lib/db/queries";
import {
  hasRecentBalanceRequest,
  sendBatchedReminders,
  sendReminder,
} from "@/lib/notify";
import { maySendClientReminder } from "@/lib/client-messaging";
import { groupBatchableReminders, type ReminderWithBooking } from "@/lib/reminder-batch";
import { sendsBalanceEmails } from "@/lib/subscriptions";

// Processes reminders whose send time has passed. Called by the Vercel Cron
// route and the "run now" dashboard button. Uses the service-role client.
export async function processDueReminders(
  sb: SupabaseClient,
  nowIso = new Date().toISOString(),
): Promise<{
  sent: number;
  skipped: number;
  checkinsSent?: number;
  checkinsSkipped?: number;
  infillSent?: number;
  infillSkipped?: number;
  precareSent?: number;
  precareSkipped?: number;
}> {
  const due = await dueReminders(sb, nowIso);
  let sent = 0;
  let skipped = 0;

  const singles: ReminderWithBooking[] = [];
  const batchCandidates: ReminderWithBooking[] = [];

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

    const tech = await getTechById(sb, reminder.techId).catch(() => null);
    if (!maySendClientReminder(tech, booking, reminder.kind)) {
      await markReminder(sb, reminder.id, {
        status: "skipped",
        preview: "Skipped — imported booking / messaging not enabled for this account",
      });
      skipped++;
      continue;
    }

    if (reminder.kind === "balance_request" && booking.balanceStatus === "paid") {
      await markReminder(sb, reminder.id, { status: "skipped" });
      skipped++;
      continue;
    }
    // Salon settles balances in person: skip already-queued balance requests.
    if (reminder.kind === "balance_request") {
      if (!sendsBalanceEmails(tech)) {
        await markReminder(sb, reminder.id, { status: "skipped" });
        skipped++;
        continue;
      }
    }

    const item = { reminder, booking };
    if (
      reminder.kind === "reminder_24h" ||
      reminder.kind === "reminder_2h" ||
      reminder.kind === "balance_request"
    ) {
      batchCandidates.push(item);
    } else {
      singles.push(item);
    }
  }

  for (const item of singles) {
    const delivered = await sendReminder(sb, item.reminder);
    if (delivered) sent++;
    else skipped++;
  }

  const groups = groupBatchableReminders(batchCandidates);
  const processed = new Set<string>();

  for (const [, group] of groups) {
    for (const item of group) processed.add(item.reminder.id);

    if (group[0].reminder.kind === "balance_request") {
      const techId = group[0].booking.techId;
      const clientId = group[0].booking.clientId;
      if (await hasRecentBalanceRequest(sb, techId, clientId)) {
        for (const item of group) {
          await markReminder(sb, item.reminder.id, {
            status: "skipped",
            preview: "Balance request skipped — already contacted this client within 48 hours",
          });
          skipped++;
        }
        continue;
      }
    }

    const delivered = await sendBatchedReminders(sb, group);
    if (delivered) sent += group.length;
    else skipped += group.length;
  }

  // Safety: any batchable reminder that wasn't grouped (shouldn't happen).
  for (const item of batchCandidates) {
    if (processed.has(item.reminder.id)) continue;
    const delivered = await sendReminder(sb, item.reminder);
    if (delivered) sent++;
    else skipped++;
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

  let infillSent = 0;
  let infillSkipped = 0;
  try {
    const { processInfillDeadlineNudges } = await import("@/lib/infill-nudge");
    const infill = await processInfillDeadlineNudges(sb, nowIso);
    infillSent = infill.sent;
    infillSkipped = infill.skipped;
  } catch {
    // Migration may be pending.
  }

  let precareSent = 0;
  let precareSkipped = 0;
  try {
    const { processDuePreCareConfirmations } = await import("@/lib/pre-care");
    const precare = await processDuePreCareConfirmations(sb, nowIso);
    precareSent = precare.sent;
    precareSkipped = precare.skipped;
  } catch {
    // Migration may be pending.
  }

  return { sent, skipped, checkinsSent, checkinsSkipped, infillSent, infillSkipped, precareSent, precareSkipped };
}
