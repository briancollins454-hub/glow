import { formatInTimeZone } from "date-fns-tz";

export const TZ = "Europe/London";

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
