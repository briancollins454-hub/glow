// Tolerant CSV parsing for migration imports (Square / Booksy / Timely / Fresha /
// Acuity exports all differ; we normalise headers and match flexibly).

import { fromZonedTime } from "date-fns-tz";
import { TZ } from "@/lib/format";

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

/** Parse full CSV text, including newlines inside quoted fields (Fresha descriptions). */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      row.push(cur.trim());
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      cur = "";
    } else {
      cur += ch;
    }
  }

  row.push(cur.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);

  return rows;
}

export function parseCsv(text: string): ParsedCsv {
  const table = parseCsvRows(text);
  if (table.length === 0) return { headers: [], rows: [] };
  const headers = table[0].map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const rows = table.slice(1).filter((r) => r.some((cell) => cell.trim()));
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
    "apptslot",
  ],
  appointmentStatus: ["status", "appointmentstatus", "bookingstatus"],
  appointmentEmail: ["email", "clientemail", "customeremail", "emailaddress"],
  appointmentPrice: [
    "netsales",
    "netsale",
    "grosssales",
    "grosssale",
    "appointmentprice",
    "price",
    "amount",
    "retailprice",
    "priceamount",
    "total",
  ],
  appointmentDuration: ["duration", "durationmin", "durationminutes", "durationmins", "servicelength"],
} as const;

export const IMPORT_SERVICE_COLS = {
  name: ["servicename", "service", "name", "itemname", "treatmentname", "title", "item"],
  price: ["price", "retailprice", "priceamount", "amount", "cost"],
  duration: ["duration", "durationmin", "durationminutes", "durationmins", "servicelength", "length"],
  category: ["category", "categoryname", "servicecategory", "group", "type"],
  description: ["description", "details", "servicedescription"],
} as const;

/** Skip rows that are clearly misparsed CSV fragments (multiline description bugs, etc.). */
export function isPlausibleServiceName(name: string): boolean {
  const n = name.trim();
  if (!n || n.length > 120) return false;
  if ((n.match(/,/g) ?? []).length >= 2) return false;
  if (/^[,;\s]+/.test(n)) return false;
  return true;
}

export type ImportAppointmentGroup = "client" | "service" | "date";

export const IMPORT_APPOINTMENT_GROUPS: {
  key: ImportAppointmentGroup;
  label: string;
  aliases: readonly string[];
}[] = [
  // Acuity splits the client into First Name / Last Name and calls the service "Type".
  { key: "client", label: "Client", aliases: [...IMPORT_COLS.appointmentClient, "firstname", "first"] },
  { key: "service", label: "Service", aliases: [...IMPORT_COLS.appointmentService, "type"] },
  { key: "date", label: "Date", aliases: [...IMPORT_COLS.appointmentDate, ...IMPORT_COLS.appointmentTime] },
];

/**
 * Acuity appointment exports: the service lives in a "Type" column (no
 * Service/Item column). Start/End Time are long-form datetimes such as
 * "December 2, 2020 9:00 am", with a separate Timezone column. "Date Scheduled"
 * is when the booking was made (YYYY-MM-DD), not the appointment start.
 */
export function isAcuityAppointmentCsv(headers: string[]): boolean {
  const hasType = col(headers, "type") !== -1;
  const hasStandardService = col(headers, ...IMPORT_COLS.appointmentService) !== -1;
  const hasDate =
    col(headers, ...IMPORT_COLS.appointmentDate) !== -1 ||
    col(headers, ...IMPORT_COLS.appointmentTime) !== -1;
  return hasType && !hasStandardService && hasDate;
}

/** Appointment service column, falling back to Acuity's "Type". */
export function appointmentServiceCol(headers: string[]): number {
  const i = col(headers, ...IMPORT_COLS.appointmentService);
  if (i !== -1) return i;
  return isAcuityAppointmentCsv(headers) ? col(headers, "type") : -1;
}

/**
 * Client name from an appointments row. Acuity exports may use a single
 * "Client Name" column or split First Name / Last Name, depending on version.
 */
export function appointmentClientName(cols: string[], headers: string[]): string {
  const iClient = col(headers, ...IMPORT_COLS.appointmentClient);
  if (iClient !== -1) return (cols[iClient] ?? "").trim();
  const iFirst = col(headers, "firstname", "first");
  const iLast = col(headers, "lastname", "last", "surname");
  return [iFirst !== -1 ? cols[iFirst] : "", iLast !== -1 ? cols[iLast] : ""]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export type AcuityDerivedService = { name: string; pricePennies: number };

/**
 * Unique services from an Acuity appointments export (Type + Appointment Price).
 * Acuity has no separate services export, so the services step derives the
 * list from here. Duration still needs filling in afterwards.
 */
export function acuityDerivedServices(
  headers: string[],
  rows: string[][],
): AcuityDerivedService[] {
  const iType = col(headers, "type");
  if (iType === -1) return [];
  const iPrice = col(headers, ...IMPORT_COLS.appointmentPrice);
  const seen = new Map<string, AcuityDerivedService>();
  for (const cols of rows) {
    const raw = (cols[iType] ?? "").trim();
    if (!raw || !isPlausibleServiceName(raw)) continue;
    const key = normalizeImportName(raw);
    if (seen.has(key)) continue;
    const pricePennies =
      iPrice !== -1 ? moneyToPennies(cols[iPrice] ?? "") : 0;
    seen.set(key, { name: raw, pricePennies });
  }
  return [...seen.values()];
}

/** Unique Type names from an Acuity appointments export. */
export function acuityServiceNames(headers: string[], rows: string[][]): string[] {
  return acuityDerivedServices(headers, rows).map((s) => s.name);
}

export type AcuityCalendarCount = { name: string; count: number };

const ACUITY_BLANK_CALENDAR = "(No calendar)";

/** Distinct Calendar values with row counts (Acuity multi-staff exports). */
export function acuityCalendarCounts(
  headers: string[],
  rows: string[][],
): AcuityCalendarCount[] {
  const i = col(headers, "calendar");
  if (i === -1) return [];
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = (row[i] ?? "").trim() || ACUITY_BLANK_CALENDAR;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Keep only rows whose Calendar is in `selected`. When there is no Calendar
 * column, rows are unchanged. Empty `selected` excludes every row that has a
 * Calendar column (caller should treat that as "nothing chosen" for multi-staff).
 */
export function filterAcuityRowsByCalendars(
  headers: string[],
  rows: string[][],
  selected: readonly string[],
): { rows: string[][]; excludedCount: number } {
  const i = col(headers, "calendar");
  if (i === -1) return { rows, excludedCount: 0 };
  if (selected.length === 0) return { rows: [], excludedCount: rows.length };
  const want = new Set(selected);
  const kept: string[][] = [];
  let excludedCount = 0;
  for (const row of rows) {
    const name = (row[i] ?? "").trim() || ACUITY_BLANK_CALENDAR;
    if (want.has(name)) kept.push(row);
    else excludedCount++;
  }
  return { rows: kept, excludedCount };
}

/**
 * Resolve which Acuity rows to import from a form submission.
 * Single-calendar (or no Calendar column): all rows, no exclusion.
 * Multi-calendar: only ticked `acuityCalendar` values; null selected means the
 * tech has not chosen anyone yet.
 */
export function resolveAcuityImportRows(
  headers: string[],
  rows: string[][],
  selectedCalendars: readonly string[],
): { rows: string[][]; excludedCount: number; needsCalendarPick: boolean } {
  const calendars = acuityCalendarCounts(headers, rows);
  if (calendars.length <= 1) {
    return { rows, excludedCount: 0, needsCalendarPick: false };
  }
  if (selectedCalendars.length === 0) {
    return { rows: [], excludedCount: rows.length, needsCalendarPick: true };
  }
  const filtered = filterAcuityRowsByCalendars(headers, rows, selectedCalendars);
  return { ...filtered, needsCalendarPick: false };
}

/** Strip Excel/Acuity leading apostrophes from phone numbers ("'+447..."). */
export function normalizeImportPhone(raw: string): string {
  return raw.trim().replace(/^'+/, "").trim();
}

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
  const hasClockTime = (s: string) => /\d{1,2}:\d{2}/.test(s);

  // Fresha Scheduled date often already includes the time ("04 Jul 2026, 3:00pm").
  if (dateOnly && hasClockTime(dateOnly)) return { dateRaw: dateOnly, timeRaw: "" };

  // Fresha often puts a full timestamp in Scheduled time / Start time.
  // Acuity Start Time is a full long-form datetime ("December 2, 2020 9:00 am")
  // — prefer that over "Date Scheduled", which is only when the booking was made.
  if (scheduled && hasDatePart(scheduled)) return { dateRaw: scheduled, timeRaw: "" };
  if (start && hasDatePart(start) && hasClockTime(start)) return { dateRaw: start, timeRaw: "" };
  if (dateOnly && (scheduled || timeOnly)) return { dateRaw: dateOnly, timeRaw: scheduled || timeOnly };
  if (dateOnly && start && !hasDatePart(start)) return { dateRaw: dateOnly, timeRaw: start };
  if (dateOnly) return { dateRaw: dateOnly, timeRaw: "" };
  if (scheduled) return { dateRaw: scheduled, timeRaw: "" };
  return { dateRaw: start, timeRaw: timeOnly };
}

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/** Normalise service names for fuzzy CSV matching (trim, lowercase, collapse spaces). */
export function normalizeImportName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function resolveImportTimeZone(timeZone?: string): string {
  const tz = (timeZone ?? "").trim();
  if (!tz) return TZ;
  try {
    // Throws RangeError for unknown IANA zones.
    new Intl.DateTimeFormat("en-GB", { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return TZ;
  }
}

function zonedLocalInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone?: string,
): Date | null {
  const local = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  try {
    const d = fromZonedTime(local, resolveImportTimeZone(timeZone));
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    // Invalid local wall times / rare date-fns-tz edge cases must not crash preview.
    return null;
  }
}

/**
 * Parse appointment date/time strings from Fresha, Acuity and other UK exports.
 * Fresha uses "04 Jul 2026, 3:00pm". Acuity uses long-form
 * "December 2, 2020 9:00 am" plus an optional IANA Timezone column.
 * Pass { monthFirst: true } only for numeric slash dates that are US-ordered.
 */
export function parseAppointmentWhen(
  dateRaw: string,
  timeRaw = "",
  opts: { monthFirst?: boolean; timeZone?: string } = {},
): Date | null {
  try {
    return parseAppointmentWhenUnsafe(dateRaw, timeRaw, opts);
  } catch {
    return null;
  }
}

function parseAppointmentWhenUnsafe(
  dateRaw: string,
  timeRaw = "",
  opts: { monthFirst?: boolean; timeZone?: string } = {},
): Date | null {
  let s = `${dateRaw.trim()} ${timeRaw.trim()}`.trim();
  if (!s) return null;

  // Acuity: "December 2, 2020 9:00 am" / "December 2, 2020 9:00am"
  const acuityLong = s.match(
    /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)$/i,
  );
  if (acuityLong) {
    const mon = MONTHS[acuityLong[1].toLowerCase().slice(0, 3)];
    const day = parseInt(acuityLong[2], 10);
    const year = parseInt(acuityLong[3], 10);
    if (mon === undefined || day < 1 || day > 31) return null;
    let hour = parseInt(acuityLong[4], 10);
    const min = parseInt(acuityLong[5], 10);
    const ap = acuityLong[6].toLowerCase();
    if (ap === "pm" && hour < 12) hour += 12;
    if (ap === "am" && hour === 12) hour = 0;
    return zonedLocalInstant(year, mon + 1, day, hour, min, opts.timeZone);
  }

  // Fresha: "04 Jul 2026, 3:00pm" / "23 Jun 2026, 9:51pm"
  const fresha = s.match(
    /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4}),?\s+(\d{1,2}):(\d{2})\s*(am|pm)?$/i,
  );
  if (fresha) {
    const day = parseInt(fresha[1], 10);
    const mon = MONTHS[fresha[2].toLowerCase().slice(0, 3)];
    const year = parseInt(fresha[3], 10);
    if (mon === undefined) return null;
    let hour = parseInt(fresha[4], 10);
    const min = parseInt(fresha[5], 10);
    const ap = (fresha[6] ?? "").toLowerCase();
    if (ap === "pm" && hour < 12) hour += 12;
    if (ap === "am" && hour === 12) hour = 0;
    return zonedLocalInstant(year, mon + 1, day, hour, min, opts.timeZone);
  }

  // Appt slot fallback: "15:00:00-16:10:00" paired with a separate date field.
  // Keeps any am/pm marker ("3:00pm") so afternoon times stay afternoon.
  const slot = timeRaw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/i);
  if (slot && dateRaw && !timeRaw.includes(",")) {
    const slotTime = `${slot[1]}:${slot[2]}${(slot[3] ?? "").toLowerCase()}`;
    const withSlot = parseAppointmentWhen(`${dateRaw.trim()} ${slotTime}`, "", opts);
    if (withSlot) return withSlot;
  }

  // Numeric slash dates: UK "04/07/2026 15:30" (day first) or, with
  // monthFirst, US "07/04/2026 3:30 PM". Out-of-range parts are rejected
  // rather than rolled over into the wrong month.
  const numeric = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*,?\s*(.*)$/);
  if (numeric) {
    const first = parseInt(numeric[1], 10);
    const second = parseInt(numeric[2], 10);
    const year = numeric[3].length === 2 ? 2000 + parseInt(numeric[3], 10) : parseInt(numeric[3], 10);
    const day = opts.monthFirst ? second : first;
    const month = opts.monthFirst ? first : second;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    let hour = 9;
    let minute = 0;
    const t = numeric[4].match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/i);
    if (t) {
      hour = parseInt(t[1], 10);
      minute = parseInt(t[2], 10);
      const ap = (t[3] ?? "").toLowerCase();
      if (ap === "pm" && hour < 12) hour += 12;
      if (ap === "am" && hour === 12) hour = 0;
    }
    return zonedLocalInstant(year, month, day, hour, minute, opts.timeZone);
  }

  if (/z$|[+-]\d{2}:?\d{2}$/i.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ]?(\d{1,2})?:?(\d{2})?/);
  if (m) {
    return zonedLocalInstant(
      parseInt(m[1], 10),
      parseInt(m[2], 10),
      parseInt(m[3], 10),
      parseInt(m[4] ?? "9", 10),
      parseInt(m[5] ?? "0", 10),
      opts.timeZone,
    );
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
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
