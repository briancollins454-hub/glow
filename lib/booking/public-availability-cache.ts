import { unstable_cache, revalidateTag } from "next/cache";
import { supabaseService } from "@/lib/supabase/service";
import {
  listBlockingBookingsInRange,
  listRotaHours,
  listServices,
  listStaff,
  listTimeOff,
  listWorkingHours,
  staffServiceDayMap,
  staffServiceMap,
} from "@/lib/db/queries";
import { addDaysToDateStr, currentWeekStartLondon } from "@/lib/rota";
import { bufferMapFromServices, withTechAvailability, type AvailabilityCtx } from "@/lib/rules";
import type { Booking, RotaHour, Service, StaffMember, Tech, TimeOff, WorkingHour } from "@/lib/db/types";

export function publicAvailabilityTag(techId: string): string {
  return `public-availability-${techId}`;
}

/** Bust the public booking availability cache after diary-changing mutations. */
export function revalidatePublicAvailability(techId: string): void {
  revalidateTag(publicAvailabilityTag(techId));
}

/** Columns the public slot picker actually needs (keeps egress small). */
export const BLOCKING_BOOKING_COLUMNS = "id, techId, startIso, endIso, status, staffId, serviceId, clientId";

export type PublicAvailabilityBundle = {
  workingHours: WorkingHour[];
  timeOff: TimeOff[];
  bookings: Booking[];
  rotaHours: RotaHour[];
  rotaFetchedRange: { fromWeek: string; toWeek: string };
  services: Service[];
  staffList: StaffMember[];
  restrictions: Record<string, string[]>;
  dayRulesByStaff: Record<string, Record<string, number[] | null>>;
};

async function fetchPublicAvailabilityBundle(techId: string): Promise<PublicAvailabilityBundle> {
  const sb = supabaseService();
  const rangeEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const rotaFrom = currentWeekStartLondon();
  const rotaTo = addDaysToDateStr(rotaFrom, 7 * 12);

  const [workingHours, timeOff, bookings, rotaHours, services, staffList] = await Promise.all([
    listWorkingHours(sb, techId),
    listTimeOff(sb, techId),
    listBlockingBookingsInRange(sb, techId, new Date().toISOString(), rangeEnd),
    listRotaHours(sb, techId, { fromWeek: rotaFrom, toWeek: rotaTo }),
    listServices(sb, techId),
    listStaff(sb, techId, { activeOnly: true }).catch(() => [] as StaffMember[]),
  ]);

  const staffIds = staffList.map((s) => s.id);
  const [restrictions, dayRulesByStaff] = await Promise.all([
    staffIds.length
      ? staffServiceMap(sb, staffIds).catch(() => ({}) as Record<string, string[]>)
      : Promise.resolve({} as Record<string, string[]>),
    staffIds.length
      ? staffServiceDayMap(sb, staffIds).catch(
          () => ({}) as Record<string, Record<string, number[] | null>>,
        )
      : Promise.resolve({} as Record<string, Record<string, number[] | null>>),
  ]);

  return {
    workingHours,
    timeOff,
    bookings,
    rotaHours,
    rotaFetchedRange: { fromWeek: rotaFrom, toWeek: rotaTo },
    services,
    staffList,
    restrictions,
    dayRulesByStaff,
  };
}

/**
 * Cached public availability for a tech (60s). Bots hammering /[handle] must not
 * fan out into 6+ Supabase queries per hit. Invalidate via revalidatePublicAvailability.
 */
export function getCachedPublicAvailabilityBundle(techId: string): Promise<PublicAvailabilityBundle> {
  return unstable_cache(
    () => fetchPublicAvailabilityBundle(techId),
    ["public-availability", techId],
    { revalidate: 60, tags: [publicAvailabilityTag(techId)] },
  )();
}

/** Build an AvailabilityCtx from a cached (or fresh) bundle + tech flexible hours. */
export function availabilityCtxFromBundle(
  bundle: PublicAvailabilityBundle,
  tech: Pick<
    Tech,
    | "flexibleHoursEnabled"
    | "flexibleStartMinutes"
    | "flexibleEndMinutes"
    | "flexibleLastStartMinutes"
  >,
): AvailabilityCtx {
  return {
    ...withTechAvailability(
      {
        workingHours: bundle.workingHours,
        timeOff: bundle.timeOff,
        bookings: bundle.bookings,
      },
      tech,
    ),
    rotaHours: bundle.rotaHours,
    rotaFetchedRange: bundle.rotaFetchedRange,
    bufferByServiceId: bufferMapFromServices(bundle.services),
  };
}

/**
 * Fresh blocking bookings for the final slot check on booking submit.
 * Intentionally uncached so double-bookings remain impossible even when the
 * display cache is up to 60s stale.
 */
export async function loadFreshBlockingBookings(techId: string): Promise<Booking[]> {
  const rangeEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  return listBlockingBookingsInRange(
    supabaseService(),
    techId,
    new Date().toISOString(),
    rangeEnd,
  );
}
