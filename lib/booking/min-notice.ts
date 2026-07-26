import type { StaffMember, Tech } from "@/lib/db/types";

/** Suggested default for new salons (existing rows stay at 0 via migration). */
export const MIN_NOTICE_HOURS_NEW_DEFAULT = 2;

/** Inclusive upper bound (one week). */
export const MIN_NOTICE_HOURS_MAX = 168;

const HOUR_MS = 60 * 60 * 1000;

/** Clamp a raw hours value into 0…168. */
export function clampMinNoticeHours(raw: unknown, fallback = 0): number {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MIN_NOTICE_HOURS_MAX, Math.max(0, Math.trunc(n)));
}

/** Business-level minimum notice (missing / null → 0, preserves pre-feature behaviour). */
export function techMinNoticeHours(
  tech: Pick<Tech, "minNoticeHours"> | null | undefined,
): number {
  if (tech?.minNoticeHours == null) return 0;
  return clampMinNoticeHours(tech.minNoticeHours, 0);
}

/**
 * Effective notice for a public booking: staff override when set, else business default.
 * Staff override of 0 is intentional (that person accepts last-minute online bookings).
 */
export function effectiveMinNoticeHours(
  tech: Pick<Tech, "minNoticeHours"> | null | undefined,
  staff?: Pick<StaffMember, "minNoticeHours"> | null,
): number {
  if (staff && staff.minNoticeHours != null) {
    return clampMinNoticeHours(staff.minNoticeHours, 0);
  }
  return techMinNoticeHours(tech);
}

/**
 * Earliest bookable start for public slots: now + effective notice.
 * Pass the result as `nowMs` into daySlotsForDuration / availableDaysForDuration
 * so the notice floor is applied at request time (not baked into the cache key).
 */
export function minNoticeFloorMs(
  tech: Pick<Tech, "minNoticeHours"> | null | undefined,
  staff?: Pick<StaffMember, "minNoticeHours"> | null,
  nowMs: number = Date.now(),
): number {
  return nowMs + effectiveMinNoticeHours(tech, staff) * HOUR_MS;
}

/** True when a slot start is still inside the notice window (must reject). */
export function isInsideMinNoticeWindow(
  slotIso: string,
  tech: Pick<Tech, "minNoticeHours"> | null | undefined,
  staff?: Pick<StaffMember, "minNoticeHours"> | null,
  nowMs: number = Date.now(),
): boolean {
  const startMs = new Date(slotIso).getTime();
  if (!Number.isFinite(startMs)) return true;
  return startMs <= minNoticeFloorMs(tech, staff, nowMs);
}
