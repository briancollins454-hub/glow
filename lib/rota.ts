/**
 * Week-by-week staff rota helpers (Europe/London calendar dates).
 * weekStart is always the Monday of that week as YYYY-MM-DD.
 */

/** Weekday of a YYYY-MM-DD calendar date (0 = Sunday … 6 = Saturday). */
export function weekdayOfDateStr(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

/** Add (or subtract) whole days from a YYYY-MM-DD string. */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday (YYYY-MM-DD) of the week containing dateStr. */
export function mondayOfWeekContaining(dateStr: string): string {
  const wd = weekdayOfDateStr(dateStr);
  const daysFromMonday = (wd + 6) % 7;
  return addDaysToDateStr(dateStr, -daysFromMonday);
}

/** Monday of the current week in Europe/London. */
export function currentWeekStartLondon(now = new Date()): string {
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return mondayOfWeekContaining(dateStr);
}

/** All 7 dates (Mon..Sun, YYYY-MM-DD) of the week containing dateStr. */
export function weekDatesContaining(dateStr: string): string[] {
  const monday = mondayOfWeekContaining(dateStr);
  return Array.from({ length: 7 }, (_, i) => addDaysToDateStr(monday, i));
}

/** e.g. "21 Jul 2026" for a weekStart Monday. */
export function formatWeekLabel(weekStart: string): string {
  const d = new Date(`${weekStart}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}
