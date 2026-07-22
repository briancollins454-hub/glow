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

/** First day of the month containing dateStr (YYYY-MM-01). */
export function firstOfMonthContaining(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

/** Shift a month-start YYYY-MM-01 by whole months (no millisecond day offsets). */
export function addMonthsToMonthStart(monthStart: string, delta: number): string {
  const y = Number(monthStart.slice(0, 4));
  const m = Number(monthStart.slice(5, 7)); // 1..12
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

/** Last day of the month that starts at monthStart (YYYY-MM-01). */
export function lastOfMonthContaining(monthStart: string): string {
  return addDaysToDateStr(addMonthsToMonthStart(monthStart, 1), -1);
}

export type MonthGridCell = { dateStr: string; inMonth: boolean };

/**
 * Monday-first month grid for a YYYY-MM-01 (or any day in that month).
 * Days outside the month are included so weeks are complete, and remain selectable.
 */
export function monthGridForMonth(monthDateStr: string): MonthGridCell[] {
  const first = firstOfMonthContaining(monthDateStr);
  const last = lastOfMonthContaining(first);
  const pad = (weekdayOfDateStr(first) + 6) % 7; // Mon=0 … Sun=6
  const gridStart = addDaysToDateStr(first, -pad);
  const cells: MonthGridCell[] = [];
  let cursor = gridStart;
  while (true) {
    cells.push({ dateStr: cursor, inMonth: cursor >= first && cursor <= last });
    cursor = addDaysToDateStr(cursor, 1);
    if (cells.length % 7 === 0 && cursor > last) break;
  }
  return cells;
}

/** Accessible label e.g. "Monday 30 November 2026". */
export function formatDateAriaLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    timeZone: "UTC",
  }).format(d);
  const rest = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
  return `${weekday} ${rest}`;
}

/** Month heading e.g. "November 2026". */
export function formatMonthHeading(monthStart: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${firstOfMonthContaining(monthStart)}T12:00:00Z`));
}
