import { normalizeImportName } from "@/lib/csv";

export const ACUITY_NO_CALENDAR = "(No calendar)";

/** Normalise Acuity Calendar / Glow staff names for matching. */
export function normalizeStaffMatchName(name: string): string {
  return normalizeImportName(name);
}

/**
 * Find a Glow staff member whose name matches an Acuity Calendar value.
 * Exact match after normalisation (trim, lowercase, collapse spaces).
 */
export function findStaffForCalendarName<T extends { id: string; name: string }>(
  calendarName: string,
  staff: readonly T[],
): T | null {
  const key = normalizeStaffMatchName(calendarName);
  if (!key || key === normalizeStaffMatchName(ACUITY_NO_CALENDAR)) return null;
  return staff.find((s) => normalizeStaffMatchName(s.name) === key) ?? null;
}

/** Calendar label from an Acuity row (blank cells become "(No calendar)"). */
export function acuityRowCalendarName(row: string[], calendarCol: number): string {
  if (calendarCol < 0) return "";
  return (row[calendarCol] ?? "").trim() || ACUITY_NO_CALENDAR;
}
