"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  IMPORT_APPOINTMENT_GROUPS,
  IMPORT_COLS,
  acuityCalendarCounts,
  acuityDerivedServices,
  appointmentColumnsOk,
  appointmentServiceCol,
  appointmentWhenRaw,
  col,
  filterAcuityRowsByCalendars,
  isAcuityAppointmentCsv,
  missingAppointmentGroups,
  parseAppointmentWhen,
  parseCsv,
  type AcuityCalendarCount,
} from "@/lib/csv";

type Kind = "services" | "clients" | "appointments";

const REQUIRED: Record<Exclude<Kind, "appointments">, string[][]> = {
  services: [["name", "servicename", "service", "itemname", "treatmentname", "title", "item"]],
  clients: [["name", "fullname", "clientname", "customername", "firstname", "first"]],
};

// Columns we understand in an Acuity appointments export. Anything beyond
// these is usually an intake form question, which Glow does not import.
const ACUITY_KNOWN_COLS = new Set<string>([
  ...IMPORT_COLS.appointmentClient,
  ...IMPORT_COLS.appointmentService,
  ...IMPORT_COLS.appointmentDate,
  ...IMPORT_COLS.appointmentTime,
  ...IMPORT_COLS.appointmentStatus,
  ...IMPORT_COLS.appointmentEmail,
  ...IMPORT_COLS.appointmentPrice,
  ...IMPORT_COLS.appointmentDuration,
  "type",
  "calendar",
  "endtime",
  "end",
  "timezone",
  "tz",
  "firstname",
  "first",
  "lastname",
  "last",
  "surname",
  "phone",
  "phonenumber",
  "mobile",
  "canceled",
  "cancelled",
  "paid",
  "amountpaid",
  "amountpaidonline",
  "appointmentprice",
  "certificate",
  "certificatecode",
  "notes",
  "label",
  "labels",
  "datescheduled",
  "daterescheduled",
  "datecreated",
  "scheduledby",
  "appointmentid",
]);

/** Cap date scanning so huge Acuity exports don't freeze the tab during preview. */
const BAD_DATE_SCAN_LIMIT = 2500;

function label(kind: Kind): string {
  if (kind === "services") return "services";
  if (kind === "clients") return "clients";
  return "appointments";
}

function describeMissing(kind: Kind, headers: string[]): string {
  if (kind === "appointments") {
    const missing = missingAppointmentGroups(headers);
    if (missing.length === 0) return "";
    const labels = missing.map(
      (key) => IMPORT_APPOINTMENT_GROUPS.find((g) => g.key === key)?.label ?? key,
    );
    return `Missing: ${labels.join(", ")}. Fresha exports usually label these as Client, Service(s) and Scheduled date.`;
  }
  const missing = REQUIRED[kind].filter((group) => col(headers, ...group) === -1).length;
  return `${missing} required column group${missing === 1 ? "" : "s"} missing.`;
}

function formatCount(n: number): string {
  return n.toLocaleString("en-GB");
}

type ParsedFile = {
  headers: string[];
  rows: string[][];
  acuity: boolean;
  calendars: AcuityCalendarCount[];
};

export function ImportPreview({ inputId, kind }: { inputId: string; kind: Kind }) {
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (!input) return;

    const onChange = async () => {
      const file = input.files?.[0];
      if (!file) {
        setParsed(null);
        setSelectedCalendars([]);
        setParseError(null);
        return;
      }
      try {
        const csv = parseCsv(await file.text());
        const acuity = isAcuityAppointmentCsv(csv.headers);
        const calendars =
          acuity && (kind === "appointments" || kind === "services")
            ? acuityCalendarCounts(csv.headers, csv.rows)
            : [];
        setParsed({ headers: csv.headers, rows: csv.rows, acuity, calendars });
        // Multi-staff Acuity: preselect nothing so we never silently merge diaries.
        setSelectedCalendars([]);
        setParseError(null);
      } catch (e) {
        console.error("[glow-import-preview]", e);
        setParsed(null);
        setSelectedCalendars([]);
        setParseError("Could not read that file. Try exporting again as CSV, or email it to support@glow-uk.com.");
      }
    };

    input.addEventListener("change", onChange);
    return () => input.removeEventListener("change", onChange);
  }, [inputId, kind]);

  const needsCalendarPick = !!parsed && parsed.acuity && parsed.calendars.length > 1;

  const filtered = useMemo(() => {
    if (!parsed) return { rows: [] as string[][], excludedCount: 0 };
    if (!needsCalendarPick) return { rows: parsed.rows, excludedCount: 0 };
    return filterAcuityRowsByCalendars(parsed.headers, parsed.rows, selectedCalendars);
  }, [parsed, needsCalendarPick, selectedCalendars]);

  const preview = useMemo(() => {
    if (!parsed) return null;

    const waitingForCalendars = needsCalendarPick && selectedCalendars.length === 0;
    const workingRows = filtered.rows;
    const excludedCount = filtered.excludedCount;
    const notes: string[] = [];
    let rows = workingRows.length;
    let ok =
      parsed.rows.length > 0 &&
      (kind === "appointments"
        ? appointmentColumnsOk(parsed.headers)
        : REQUIRED[kind].every((group) => col(parsed.headers, ...group) !== -1));

    if (kind === "services" && !ok && parsed.acuity && parsed.rows.length > 0) {
      ok = true;
      if (waitingForCalendars) {
        rows = 0;
      } else {
        const services = acuityDerivedServices(parsed.headers, workingRows);
        rows = services.length;
        if (services.length === 0) {
          ok = false;
        } else {
          const fromCalendars = needsCalendarPick
            ? ` from the selected calendar${selectedCalendars.length === 1 ? "" : "s"}`
            : "";
          notes.push(
            `Acuity export detected: services are read from the appointments file because Acuity does not export services separately. ${services.length} service${services.length === 1 ? "" : "s"} will be created${fromCalendars}, with Appointment Price when present. Check durations afterwards.`,
          );
          if (excludedCount > 0) {
            notes.push(
              `${formatCount(excludedCount)} appointment${excludedCount === 1 ? "" : "s"} excluded, other calendars.`,
            );
          }
        }
      }
    }

    if (kind === "appointments" && ok && parsed.acuity) {
      notes.push(
        "Acuity export detected: Start/End Time are read as long-form dates (for example December 2, 2020 9:00 am) using the Timezone column. Date Scheduled is when the booking was made and is ignored.",
      );

      if (waitingForCalendars) {
        rows = 0;
      } else {
        const iTimezone = col(parsed.headers, "timezone", "tz");
        const scan = workingRows.slice(0, BAD_DATE_SCAN_LIMIT);
        let bad = 0;
        for (const row of scan) {
          try {
            const { dateRaw, timeRaw } = appointmentWhenRaw(row, parsed.headers);
            const timeZone = iTimezone !== -1 ? (row[iTimezone] ?? "").trim() : "";
            if (!parseAppointmentWhen(dateRaw, timeRaw, { timeZone })) bad++;
          } catch {
            bad++;
          }
        }
        if (bad > 0) {
          const sampled =
            workingRows.length > BAD_DATE_SCAN_LIMIT
              ? ` (checked first ${formatCount(BAD_DATE_SCAN_LIMIT)} rows)`
              : "";
          notes.push(
            `${bad} row${bad === 1 ? "" : "s"} have dates we cannot read, so they will be skipped${sampled}.`,
          );
        }
        if (excludedCount > 0) {
          notes.push(
            `${formatCount(excludedCount)} appointment${excludedCount === 1 ? "" : "s"} excluded, other calendars.`,
          );
        }
      }

      const extras = parsed.headers.filter((h) => h && !ACUITY_KNOWN_COLS.has(h)).length;
      if (extras > 0) {
        notes.push(
          "Extra columns such as Certificate Code, Label, Scheduled By and Appointment ID are not imported.",
        );
      }
    }

    const sample =
      kind === "appointments"
        ? (() => {
            const row = workingRows[0];
            if (!row) return "";
            const iClient = col(parsed.headers, ...IMPORT_COLS.appointmentClient);
            const iFirst = col(parsed.headers, "firstname", "first");
            const iService = appointmentServiceCol(parsed.headers);
            const { dateRaw } = appointmentWhenRaw(row, parsed.headers);
            const client =
              iClient !== -1
                ? row[iClient]
                : iFirst !== -1
                  ? [row[iFirst], row[col(parsed.headers, "lastname", "last", "surname")] ?? ""]
                      .filter(Boolean)
                      .join(" ")
                  : "";
            const parts = [client, iService !== -1 ? row[iService] : "", dateRaw].filter(Boolean);
            return parts.join(" · ");
          })()
        : (workingRows[0]?.slice(0, 4).filter(Boolean).join(" · ") ?? "");

    return {
      ok,
      rows,
      waitingForCalendars,
      notes,
      sample,
      detail: ok ? "" : describeMissing(kind, parsed.headers),
    };
  }, [parsed, filtered, needsCalendarPick, selectedCalendars, kind]);

  if (parseError) {
    return (
      <div className="mt-3 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        <p className="flex items-center gap-2 font-medium">
          <AlertTriangle className="h-4 w-4" />
          {parseError}
        </p>
      </div>
    );
  }

  if (!parsed || !preview) return null;

  const toggleCalendar = (name: string, checked: boolean) => {
    setSelectedCalendars((prev) => {
      if (checked) return prev.includes(name) ? prev : [...prev, name];
      return prev.filter((n) => n !== name);
    });
  };

  return (
    <div className="mt-3 space-y-3">
      {needsCalendarPick && (
        <div className="rounded-xl border border-edge bg-cream px-4 py-3 text-sm text-ink">
          <p className="text-ink-soft">
            This export contains appointments for more than one staff member. Glow is a single
            diary, so pick whose appointments to import.
          </p>
          <ul className="mt-3 space-y-2">
            {parsed.calendars.map((cal) => (
              <li key={cal.name}>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    name="acuityCalendar"
                    value={cal.name}
                    checked={selectedCalendars.includes(cal.name)}
                    onChange={(e) => toggleCalendar(cal.name, e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-black/20 text-brand-400 focus:ring-brand-300"
                  />
                  <span>
                    <span className="font-medium">{cal.name}</span>
                    <span className="text-ink-soft">
                      , {formatCount(cal.count)} appointment{cal.count === 1 ? "" : "s"}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        className={`rounded-xl px-4 py-3 text-sm ${
          preview.ok && !preview.waitingForCalendars
            ? "bg-emerald-500/10 text-emerald-300"
            : "bg-amber-500/10 text-amber-300"
        }`}
      >
        <p className="flex items-center gap-2 font-medium">
          {preview.ok && !preview.waitingForCalendars ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          {preview.waitingForCalendars
            ? "Pick at least one calendar above to preview the import."
            : preview.ok
              ? `Looks ready: ${formatCount(preview.rows)} ${label(kind)} found.`
              : `Check this file: ${preview.detail}`}
        </p>
        {!preview.waitingForCalendars &&
          preview.notes.map((note, i) => (
            <p key={i} className="mt-1 text-xs opacity-80">
              {note}
            </p>
          ))}
        {!preview.waitingForCalendars && preview.sample && (
          <p className="mt-1 text-xs opacity-80">First row: {preview.sample}</p>
        )}
      </div>
    </div>
  );
}
