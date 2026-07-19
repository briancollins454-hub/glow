import { formatInTimeZone } from "date-fns-tz";
import { TZ } from "@/lib/format";
import { dateStrInTz } from "@/lib/rules";
import type { Booking, StaffMember } from "@/lib/db/types";

export const UNASSIGNED_STAFF_ID = "__unassigned__";

/** Minutes from midnight in Europe/London for an ISO instant. */
export function minutesFromMidnightLondon(iso: string): number {
  const hm = formatInTimeZone(new Date(iso), TZ, "HH:mm");
  const [h = "0", m = "0"] = hm.split(":");
  return Number(h) * 60 + Number(m);
}

export function activeBookingsOnDate(bookings: Booking[], dateStr: string): Booking[] {
  return bookings
    .filter((b) => b.status !== "cancelled" && dateStrInTz(new Date(b.startIso)) === dateStr)
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
}

/** Staff columns for the day (active staff order + unassigned if needed). */
export function staffColumnsForDay(
  staff: StaffMember[],
  dayBookings: Booking[],
): { id: string; name: string }[] {
  const cols = staff
    .filter((s) => s.active)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((s) => ({ id: s.id, name: s.name }));

  const known = new Set(cols.map((c) => c.id));
  const needsUnassigned = dayBookings.some((b) => !b.staffId || !known.has(b.staffId));
  if (needsUnassigned) {
    cols.push({ id: UNASSIGNED_STAFF_ID, name: "Unassigned" });
  }
  return cols;
}

export function bookingsInColumn(
  dayBookings: Booking[],
  columnId: string,
  knownStaffIds: Set<string>,
): Booking[] {
  if (columnId === UNASSIGNED_STAFF_ID) {
    return dayBookings.filter((b) => !b.staffId || !knownStaffIds.has(b.staffId));
  }
  return dayBookings.filter((b) => b.staffId === columnId);
}

/** Visible day window in minutes from midnight (padded around bookings). */
export function dayWindowMinutes(
  dayBookings: Booking[],
  bufferByServiceId: Record<string, number> = {},
): { start: number; end: number } {
  let start = 9 * 60;
  let end = 17 * 60;
  for (const b of dayBookings) {
    const s = minutesFromMidnightLondon(b.startIso);
    const e =
      minutesFromMidnightLondon(b.endIso) + Math.max(0, bufferByServiceId[b.serviceId] ?? 0);
    start = Math.min(start, s);
    end = Math.max(end, e);
  }
  // Pad half an hour; clamp to a sensible salon day.
  start = Math.max(6 * 60, Math.floor(start / 30) * 30 - 30);
  end = Math.min(22 * 60, Math.ceil(end / 30) * 30 + 30);
  if (end <= start) end = start + 60;
  return { start, end };
}

export type LaidOutBooking = {
  booking: Booking;
  lane: number;
  laneCount: number;
  startM: number;
  endM: number;
};

/**
 * Pack overlapping bookings into side-by-side lanes (like a salon diary).
 * endM should already include any buffer minutes for layout height.
 */
export function packBookingLanes(
  bookings: Booking[],
  endMinutesFor: (b: Booking) => number,
): LaidOutBooking[] {
  const items = bookings
    .map((booking) => {
      const startM = minutesFromMidnightLondon(booking.startIso);
      const endM = Math.max(startM + 15, endMinutesFor(booking));
      return { booking, startM, endM, lane: 0, laneCount: 1 };
    })
    .sort((a, b) => a.startM - b.startM || a.endM - b.endM);

  const laneEnds: number[] = [];
  for (const item of items) {
    let lane = laneEnds.findIndex((end) => end <= item.startM);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endM);
    } else {
      laneEnds[lane] = item.endM;
    }
    item.lane = lane;
  }

  // Widen each event to the max concurrent lanes in its overlap cluster.
  for (let i = 0; i < items.length; i++) {
    let maxLane = items[i]!.lane;
    for (let j = 0; j < items.length; j++) {
      if (i === j) continue;
      const a = items[i]!;
      const b = items[j]!;
      if (a.startM < b.endM && b.startM < a.endM) {
        maxLane = Math.max(maxLane, b.lane);
      }
    }
    items[i]!.laneCount = maxLane + 1;
  }

  return items;
}
