import { formatInTimeZone } from "date-fns-tz";
import type { Booking, Reminder, ReminderKind } from "@/lib/db/types";
import { TZ } from "@/lib/format";

export type ReminderWithBooking = {
  reminder: Reminder;
  booking: Booking;
};

/** Europe/London calendar day for grouping same-day appointments. */
export function londonDayKey(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, "yyyy-MM-dd");
}

export function reminderBatchKey(
  kind: ReminderKind,
  techId: string,
  clientId: string,
  bookingStartIso: string,
): string {
  if (kind === "reminder_24h" || kind === "reminder_2h") {
    return `${kind}|${techId}|${clientId}|${londonDayKey(bookingStartIso)}`;
  }
  if (kind === "balance_request") {
    return `balance_request|${techId}|${clientId}`;
  }
  return `${kind}|${techId}|${clientId}|${bookingStartIso}`;
}

/** Group due reminders that should share one email (24h / 2h by day; balance by client). */
export function groupBatchableReminders(
  items: ReminderWithBooking[],
): Map<string, ReminderWithBooking[]> {
  const groups = new Map<string, ReminderWithBooking[]>();
  for (const item of items) {
    const kind = item.reminder.kind;
    if (kind !== "reminder_24h" && kind !== "reminder_2h" && kind !== "balance_request") {
      continue;
    }
    const key = reminderBatchKey(
      kind,
      item.reminder.techId,
      item.booking.clientId,
      item.booking.startIso,
    );
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    list.sort(
      (a, b) =>
        new Date(a.booking.startIso).getTime() - new Date(b.booking.startIso).getTime(),
    );
  }
  return groups;
}

export const BALANCE_REQUEST_COOLDOWN_MS = 48 * 60 * 60 * 1000;
