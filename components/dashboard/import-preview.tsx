"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  IMPORT_APPOINTMENT_GROUPS,
  appointmentColumnsOk,
  col,
  missingAppointmentGroups,
  parseCsv,
} from "@/lib/csv";

type Kind = "services" | "clients" | "appointments";

const REQUIRED: Record<Exclude<Kind, "appointments">, string[][]> = {
  services: [["name", "servicename", "service", "itemname", "treatmentname", "title", "item"]],
  clients: [["name", "fullname", "clientname", "customername", "firstname", "first"]],
};

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
      const ok =
        parsed.rows.length > 0 &&
        (kind === "appointments"
          ? appointmentColumnsOk(parsed.headers)
          : REQUIRED[kind].every((group) => col(parsed.headers, ...group) !== -1));
      const sample = parsed.rows[0]?.slice(0, 4).filter(Boolean).join(" · ") ?? "";
      const detail = ok ? "" : describeMissing(kind, parsed.headers);
      setState({ rows: parsed.rows.length, ok, sample, detail });
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
      {state.sample && <p className="mt-1 text-xs opacity-80">First row: {state.sample}</p>}
    </div>
  );
}
