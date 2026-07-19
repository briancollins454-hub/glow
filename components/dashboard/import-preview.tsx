"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  IMPORT_APPOINTMENT_GROUPS,
  IMPORT_COLS,
  acuityServiceNames,
  appointmentColumnsOk,
  appointmentServiceCol,
  appointmentWhenRaw,
  col,
  isAcuityAppointmentCsv,
  missingAppointmentGroups,
  parseAppointmentWhen,
  parseCsv,
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
  "appointmentprice",
  "certificate",
  "notes",
  "label",
  "labels",
  "datescheduled",
  "datecreated",
]);

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

export function ImportPreview({ inputId, kind }: { inputId: string; kind: Kind }) {
  const [state, setState] = useState<{
    rows: number;
    ok: boolean;
    sample: string;
    detail: string;
    notes: string[];
  } | null>(null);

  useEffect(() => {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (!input) return;

    const onChange = async () => {
      const file = input.files?.[0];
      if (!file) {
        setState(null);
        return;
      }
      const parsed = parseCsv(await file.text());
      const acuity = isAcuityAppointmentCsv(parsed.headers);
      const notes: string[] = [];
      let rows = parsed.rows.length;

      let ok =
        parsed.rows.length > 0 &&
        (kind === "appointments"
          ? appointmentColumnsOk(parsed.headers)
          : REQUIRED[kind].every((group) => col(parsed.headers, ...group) !== -1));

      // Acuity has no services export: the services step accepts the Acuity
      // appointments file and derives services from the Type column.
      if (kind === "services" && !ok && acuity && parsed.rows.length > 0) {
        const derived = acuityServiceNames(parsed.headers, parsed.rows);
        if (derived.length > 0) {
          ok = true;
          rows = derived.length;
          notes.push(
            `Acuity export detected: services are read from the appointments file because Acuity does not export services separately. ${derived.length} service${derived.length === 1 ? "" : "s"} will be created with a default price and duration for you to fill in.`,
          );
        }
      }

      if (kind === "appointments" && ok && acuity) {
        notes.push("Acuity export detected: dates will be read as US month-first (MM/DD/YYYY).");

        const bad = parsed.rows.filter((row) => {
          const { dateRaw, timeRaw } = appointmentWhenRaw(row, parsed.headers);
          return !parseAppointmentWhen(dateRaw, timeRaw, { monthFirst: true });
        }).length;
        if (bad > 0) {
          notes.push(
            `${bad} row${bad === 1 ? "" : "s"} have dates we cannot read as MM/DD/YYYY, so they will be skipped.`,
          );
        }

        const extras = parsed.headers.filter((h) => h && !ACUITY_KNOWN_COLS.has(h)).length;
        if (extras > 0) {
          notes.push("Intake form answer columns are not imported.");
        }
      }

      const sample =
        kind === "appointments"
          ? (() => {
              const row = parsed.rows[0];
              if (!row) return "";
              const iClient = col(parsed.headers, ...IMPORT_COLS.appointmentClient);
              const iService = appointmentServiceCol(parsed.headers);
              const iDate = col(parsed.headers, ...IMPORT_COLS.appointmentDate);
              const parts = [
                iClient !== -1 ? row[iClient] : "",
                iService !== -1 ? row[iService] : "",
                iDate !== -1 ? row[iDate] : "",
              ].filter(Boolean);
              return parts.join(" · ");
            })()
          : (parsed.rows[0]?.slice(0, 4).filter(Boolean).join(" · ") ?? "");
      const detail = ok ? "" : describeMissing(kind, parsed.headers);
      setState({ rows, ok, sample, detail, notes });
    };

    input.addEventListener("change", onChange);
    return () => input.removeEventListener("change", onChange);
  }, [inputId, kind]);

  if (!state) return null;

  return (
    <div
      className={`mt-3 rounded-xl px-4 py-3 text-sm ${state.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}
    >
      <p className="flex items-center gap-2 font-medium">
        {state.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        {state.ok
          ? `Looks ready: ${state.rows} ${label(kind)} found.`
          : `Check this file: ${state.detail}`}
      </p>
      {state.notes.map((note) => (
        <p key={note} className="mt-1 text-xs opacity-80">
          {note}
        </p>
      ))}
      {state.sample && <p className="mt-1 text-xs opacity-80">First row: {state.sample}</p>}
    </div>
  );
}
