// Tolerant CSV parsing for migration imports (Square / Booksy / Timely / Fresha
// exports all differ; we normalise headers and match flexibly).

export interface ParsedCsv {
  /** Normalised headers: lowercase, letters only ("First Name" -> "firstname") */
  headers: string[];
  rows: string[][];
}

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseCsv(text: string): ParsedCsv {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
}

/** Index of the first header matching any of the given normalised names. */
export function col(headers: string[], ...names: string[]): number {
  return headers.findIndex((h) => names.includes(h));
}

/** Shared column aliases for migration CSV imports (Square, Booksy, Timely, Fresha). */
export const IMPORT_COLS = {
  appointmentClient: [
    "client",
    "clientname",
    "customer",
    "customername",
    "name",
    "fullname",
  ],
  appointmentService: [
    "service",
    "services",
    "servicename",
    "item",
    "treatment",
    "appointmentservice",
    "itemname",
    "treatmentname",
    "bookedservice",
  ],
  appointmentDate: [
    "scheduleddate",
    "date",
    "appointmentdate",
    "startdate",
    "datetime",
    "startsat",
    "start",
  ],
  appointmentTime: [
    "scheduledtime",
    "starttime",
    "time",
    "appointmenttime",
  ],
  appointmentStatus: ["status", "appointmentstatus", "bookingstatus"],
  appointmentEmail: ["email", "clientemail", "customeremail", "emailaddress"],
  appointmentPrice: ["netsale", "grosssale", "price", "amount", "retailprice", "priceamount", "total"],
  appointmentDuration: ["duration", "durationmin", "durationminutes", "durationmins", "servicelength"],
} as const;

export type ImportAppointmentGroup = "client" | "service" | "date";

export const IMPORT_APPOINTMENT_GROUPS: {
  key: ImportAppointmentGroup;
  label: string;
  aliases: readonly string[];
}[] = [
  { key: "client", label: "Client", aliases: IMPORT_COLS.appointmentClient },
  { key: "service", label: "Service", aliases: IMPORT_COLS.appointmentService },
  { key: "date", label: "Date", aliases: [...IMPORT_COLS.appointmentDate, ...IMPORT_COLS.appointmentTime] },
];

export function missingAppointmentGroups(headers: string[]): ImportAppointmentGroup[] {
  return IMPORT_APPOINTMENT_GROUPS.filter((g) => col(headers, ...g.aliases) === -1).map((g) => g.key);
}

export function appointmentColumnsOk(headers: string[]): boolean {
  return missingAppointmentGroups(headers).length === 0;
}

/** Resolve a Fresha/Square-style date + optional time column into one string. */
export function appointmentWhenRaw(
  cols: string[],
  headers: string[],
): { dateRaw: string; timeRaw: string } {
  const iScheduledTime = col(headers, "scheduledtime");
  const iStartTime = col(headers, "starttime");
  const iDate = col(headers, ...IMPORT_COLS.appointmentDate);
  const iTime = col(headers, ...IMPORT_COLS.appointmentTime);

  const scheduled = iScheduledTime !== -1 ? (cols[iScheduledTime] ?? "").trim() : "";
  const start = iStartTime !== -1 ? (cols[iStartTime] ?? "").trim() : "";
  const dateOnly = iDate !== -1 ? (cols[iDate] ?? "").trim() : "";
  const timeOnly =
    iTime !== -1 && iTime !== iScheduledTime && iTime !== iStartTime ? (cols[iTime] ?? "").trim() : "";

  const hasDatePart = (s: string) => /\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s);

  // Fresha often puts a full timestamp in Scheduled time / Start time.
  if (scheduled && hasDatePart(scheduled)) return { dateRaw: scheduled, timeRaw: "" };
  if (start && hasDatePart(start) && /\d{1,2}:\d{2}/.test(start)) return { dateRaw: start, timeRaw: "" };
  if (dateOnly && (scheduled || timeOnly)) return { dateRaw: dateOnly, timeRaw: scheduled || timeOnly };
  if (dateOnly) return { dateRaw: dateOnly, timeRaw: "" };
  if (scheduled) return { dateRaw: scheduled, timeRaw: "" };
  return { dateRaw: start, timeRaw: timeOnly };
}

/** Postgres integer max — keep imports well below this. */
export const PG_INT_MAX = 2_147_483_647;

/** Sensible upper bound for beauty service prices (£5,000). */
export const MAX_PENNIES = 500_000;

/** Sensible upper bound for appointment duration (8 hours). */
export const MAX_MINUTES = 480;

export function safePennies(pennies: number, fallback = 0): number {
  if (!Number.isFinite(pennies) || pennies < 0) return fallback;
  return Math.min(Math.round(pennies), MAX_PENNIES);
}

export function safeMinutes(minutes: number, fallback = 60): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return fallback;
  return Math.min(Math.round(minutes), MAX_MINUTES);
}

/** "£45.00", "45", "45.5" -> pennies. NaN-safe. Rejects large integer IDs. */
export function moneyToPennies(raw: string): number {
  const s = raw.trim();
  if (!s) return 0;
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (Number.isNaN(n) || n < 0) return 0;
  // Fresha/Square IDs and phone fragments often land in price columns — not GBP.
  if (!s.includes(".") && n >= 100_000) return 0;
  return safePennies(Math.round(n * 100));
}

/** "1h 30m", "90", "90 min", "1:30" -> minutes. */
export function toMinutes(raw: string): number {
  const s = raw.trim().toLowerCase();
  if (!s) return 0;
  const hm = s.match(/^(\d+):(\d{2})$/);
  if (hm) return safeMinutes(parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10));
  const h = s.match(/(\d+(?:\.\d+)?)\s*h/);
  const m = s.match(/(\d+)\s*m/);
  if (h || m) {
    return safeMinutes(Math.round((h ? parseFloat(h[1]) * 60 : 0) + (m ? parseInt(m[1], 10) : 0)));
  }
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (Number.isNaN(n)) return 0;
  // Large bare numbers are usually IDs, not minute counts.
  if (n > MAX_MINUTES) return 60;
  return safeMinutes(Math.round(n));
}
