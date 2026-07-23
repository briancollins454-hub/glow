import type { SupabaseClient } from "@supabase/supabase-js";
import { workingHoursForStaff, rowsForStaff } from "@/lib/booking/staff";
import { timeOffAppliesToStaff } from "@/lib/booking/staff-day";
import {
  BLOCKING_STATUSES,
  bufferMapFromServices,
  dateStrInTz,
  daySlotsForDuration,
  flexibleHoursFromTech,
} from "@/lib/rules";
import type { Booking, Service, StaffMember, Tech } from "@/lib/db/types";

export type SlotConflict = {
  bookingId: string;
  clientName: string;
  startIso: string;
};

export type DashboardSlotCheckResult =
  | { ok: true }
  | { ok: false; reason: "conflict"; conflict: SlotConflict }
  | { ok: false; reason: "unavailable" }
  | { ok: false; reason: "verify_failed"; error: unknown };

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Find the first active booking that overlaps the proposed appointment (buffers included). */
export function findOverlappingBooking(
  startIso: string,
  durationMin: number,
  bookings: Booking[],
  opts?: {
    bufferByServiceId?: Record<string, number>;
    excludeBookingId?: string | null;
  },
): Booking | null {
  const startMs = new Date(startIso).getTime();
  const endMs = startMs + durationMin * 60 * 1000;
  const excludeId = opts?.excludeBookingId ?? null;
  const buffers = opts?.bufferByServiceId ?? {};

  for (const b of bookings) {
    if (excludeId && b.id === excludeId) continue;
    if (!BLOCKING_STATUSES.includes(b.status)) continue;
    const bufferMin = Math.max(0, buffers[b.serviceId] ?? 0);
    const bStart = new Date(b.startIso).getTime();
    const bEnd = new Date(b.endIso).getTime() + bufferMin * 60 * 1000;
    if (rangesOverlap(startMs, endMs, bStart, bEnd)) return b;
  }
  return null;
}

/**
 * Staff-scoped availability check for dashboard manual add / reschedule.
 * Fail-closed: query failures return verify_failed (never soft-allow).
 */
export async function checkDashboardStaffSlot(
  sb: SupabaseClient,
  tech: Tech,
  opts: {
    startIso: string;
    durationMin: number;
    staffId: string | null;
    excludeBookingId?: string | null;
    clientNameFor?: (clientId: string) => string | Promise<string>;
  },
): Promise<DashboardSlotCheckResult> {
  try {
    const {
      listWorkingHours,
      listTimeOff,
      listBookingsInWindow,
      listRotaHours,
      listStaff,
      listServices,
      getStaff,
      getClient,
    } = await import("@/lib/db/queries");
    const { supabaseService } = await import("@/lib/supabase/service");

    const dateStr = dateStrInTz(new Date(opts.startIso));
    const dayMs = 24 * 60 * 60 * 1000;
    const windowStart = new Date(new Date(opts.startIso).getTime() - dayMs).toISOString();
    const windowEnd = new Date(new Date(opts.startIso).getTime() + dayMs).toISOString();

    const [allHours, offs, nearby, rotaHours, staffList, allServices] = await Promise.all([
      listWorkingHours(sb, tech.id),
      listTimeOff(sb, tech.id),
      listBookingsInWindow(sb, tech.id, windowStart, windowEnd),
      listRotaHours(sb, tech.id),
      listStaff(supabaseService(), tech.id, { activeOnly: true }),
      listServices(sb, tech.id),
    ]);

    const owner = staffList.find((s) => s.role === "owner") ?? null;
    let member: StaffMember | null =
      (opts.staffId
        ? staffList.find((s) => s.id === opts.staffId) ??
          (await getStaff(sb, opts.staffId).catch(() => null))
        : null) ??
      owner ??
      null;

    const workingHours = member
      ? workingHoursForStaff(allHours, member, owner?.id)
      : allHours.filter((h) => h.staffId == null);
    const scopedBookings = member ? rowsForStaff(nearby, member) : nearby;
    const scopedOffs = member ? timeOffAppliesToStaff(offs, member.id) : offs;
    const scopedRota = member ? rowsForStaff(rotaHours, member) : [];
    const bufferByServiceId = bufferMapFromServices(allServices as Service[]);

    const free = daySlotsForDuration(
      opts.durationMin,
      dateStr,
      {
        workingHours,
        timeOff: scopedOffs,
        bookings: scopedBookings.filter((b) => b.id !== opts.excludeBookingId),
        flexibleHours: flexibleHoursFromTech(tech),
        rotaHours: scopedRota,
        bufferByServiceId,
      },
      0,
    );

    if (free.includes(opts.startIso)) return { ok: true };

    const conflictBooking = findOverlappingBooking(
      opts.startIso,
      opts.durationMin,
      scopedBookings,
      { bufferByServiceId, excludeBookingId: opts.excludeBookingId },
    );

    if (conflictBooking) {
      let clientName = "another client";
      if (opts.clientNameFor) {
        clientName = await opts.clientNameFor(conflictBooking.clientId);
      } else {
        const client = await getClient(sb, conflictBooking.clientId);
        clientName = client?.name?.trim() || "another client";
      }
      return {
        ok: false,
        reason: "conflict",
        conflict: {
          bookingId: conflictBooking.id,
          clientName,
          startIso: conflictBooking.startIso,
        },
      };
    }

    return { ok: false, reason: "unavailable" };
  } catch (error) {
    console.error("[checkDashboardStaffSlot] availability check failed", error);
    return { ok: false, reason: "verify_failed", error };
  }
}

/** Query string fragment naming a conflicting booking for dashboard redirects. */
export function slotConflictQuery(conflict: SlotConflict): string {
  const params = new URLSearchParams({
    conflict: conflict.clientName,
    at: conflict.startIso,
  });
  return params.toString();
}
