"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { col, parseCsv } from "@/lib/csv";

type Kind = "services" | "clients" | "appointments";

const REQUIRED: Record<Kind, string[][]> = {
  services: [["name", "servicename", "service", "itemname", "treatmentname", "title", "item"]],
  clients: [["name", "fullname", "clientname", "customername", "firstname", "first"]],
  appointments: [
    ["client", "clientname", "customer", "customername", "name", "fullname"],
    ["service", "servicename", "item", "treatment", "appointmentservice", "itemname"],
    ["datetime", "date", "startsat", "start", "starttime", "appointmentdate", "startdate"],
  ],
};

function label(kind: Kind): string {
  if (kind === "services") return "services";
  if (kind === "clients") return "clients";
  return "appointments";
}

export function ImportPreview({ inputId, kind }: { inputId: string; kind: Kind }) {
  const [state, setState] = useState<{ rows: number; ok: boolean; sample: string; missing: number } | null>(null);

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
      const missing = REQUIRED[kind].filter((group) => col(parsed.headers, ...group) === -1).length;
      const sample = parsed.rows[0]?.slice(0, 4).filter(Boolean).join(" · ") ?? "";
      setState({ rows: parsed.rows.length, ok: parsed.rows.length > 0 && missing === 0, sample, missing });
    };

    input.addEventListener("change", onChange);
    return () => input.removeEventListener("change", onChange);
  }, [inputId, kind]);

  if (!state) return null;

  return (
    <div className={`mt-3 rounded-xl px-4 py-3 text-sm ${state.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
      <p className="flex items-center gap-2 font-medium">
        {state.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        {state.ok ? `Looks ready: ${state.rows} ${label(kind)} found.` : `Check this file: ${state.missing} required column group${state.missing === 1 ? "" : "s"} missing.`}
      </p>
      {state.sample && <p className="mt-1 text-xs opacity-80">First row: {state.sample}</p>}
    </div>
  );
}
