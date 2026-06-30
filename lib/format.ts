import { formatInTimeZone } from "date-fns-tz";

export const TZ = "Europe/London";

/** Format pennies (integer) as GBP. */
export function gbp(pennies: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((pennies ?? 0) / 100);
}

/** Parse a "£12.50" / "12.5" string into integer pennies. */
export function poundsToPennies(value: string | number): number {
  if (typeof value === "number") return Math.round(value * 100);
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  return Math.round(parseFloat(cleaned) * 100);
}

export function fmtDate(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, "EEE d MMM yyyy");
}

export function fmtTime(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, "HH:mm");
}

export function fmtDateTime(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, "EEE d MMM yyyy 'at' HH:mm");
}

export function fmtRelativeDays(iso: string): string {
  const days = Math.round(
    (new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
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
