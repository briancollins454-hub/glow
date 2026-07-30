import { formatInTimeZone } from "date-fns-tz";

/**
 * Date/time formatting in an explicit timezone. Pass the salon's zone
 * (salonTz(tech) / useSalonTz()) for anything a tech or client sees, and
 * PLATFORM_TZ for Glow's own analytics. There is deliberately no default —
 * a missing timezone must be a compile error, not a silent London fallback.
 */

export function fmtDate(iso: string, tz: string): string {
  return formatInTimeZone(new Date(iso), tz, "EEE d MMM yyyy");
}

export function fmtTime(iso: string, tz: string): string {
  return formatInTimeZone(new Date(iso), tz, "HH:mm");
}

export function fmtDateTime(iso: string, tz: string): string {
  return formatInTimeZone(new Date(iso), tz, "EEE d MMM yyyy 'at' HH:mm");
}

/** Calendar date (YYYY-MM-DD) of an instant in the given timezone. */
function dayKey(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

/**
 * "today" / "tomorrow" / "in N days" by comparing calendar dates in the given
 * timezone, so something after midnight in the salon's zone says "tomorrow"
 * even when it is less than 24 hours away.
 */
export function fmtRelativeDays(iso: string, tz: string, nowMs = Date.now()): string {
  const target = dayKey(new Date(iso).getTime(), tz);
  const today = dayKey(nowMs, tz);
  // Count calendar-day steps between the two dates (independent of DST).
  const targetUtc = Date.UTC(
    Number(target.slice(0, 4)),
    Number(target.slice(5, 7)) - 1,
    Number(target.slice(8, 10)),
  );
  const todayUtc = Date.UTC(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10)),
  );
  const days = Math.round((targetUtc - todayUtc) / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 1) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

export function minutesToLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
