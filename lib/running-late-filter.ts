import { dateStrInTz } from "@/lib/rules";
import type { Booking } from "@/lib/db/types";

const ACTIVE_STATUSES: Booking["status"][] = ["pending_approval", "pending", "confirmed"];
/** Include appointments that started up to this long ago (client still waiting). */
const GRACE_MS = 30 * 60 * 1000;

/** Pure filter used by the dashboard calendar (safe for client components). */
export function filterLateCascadeBookings(
  bookings: Booking[],
  targetDate: string,
  nowMs = Date.now(),
): Booking[] {
  return bookings
    .filter((b) => {
      if (!ACTIVE_STATUSES.includes(b.status)) return false;
      if (dateStrInTz(new Date(b.startIso)) !== targetDate) return false;
      const endMs = new Date(b.endIso || b.startIso).getTime();
      if (endMs <= nowMs) return false;
      const startMs = new Date(b.startIso).getTime();
      if (startMs < nowMs - GRACE_MS) return false;
      return true;
    })
    .sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());
}

export function todayDateStr(now = new Date()): string {
  return dateStrInTz(now);
}
