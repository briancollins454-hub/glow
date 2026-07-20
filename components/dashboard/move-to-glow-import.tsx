"use client";

import { useRouter } from "next/navigation";
import { Users, Scissors, CalendarDays, CheckCircle2, FolderInput } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { ImportPreview } from "@/components/dashboard/import-preview";
import { prepareCsvImportUploadAction } from "@/app/dashboard/csv-import-actions";
import { CSV_DIRECT_UPLOAD_MAX_BYTES } from "@/lib/import/csv-source";
import { importResultUrl } from "@/lib/import/import-url";

const fileInputClass =
  "text-sm text-ink-soft file:mr-2 file:rounded-lg file:border-0 file:bg-brand-500/15 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-text";

export type MoveToGlowImportActions = {
  importClients: (formData: FormData) => Promise<void>;
  importServices: (formData: FormData) => Promise<void>;
  importBookings: (formData: FormData) => Promise<void>;
};

function isNextRedirect(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    String((e as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

/** Stage oversized CSVs in Storage so the Server Action body stays under Vercel's limit. */
async function stageCsvIfNeeded(formData: FormData): Promise<FormData> {
  const file = formData.get("csv");
  if (!file || typeof file !== "object" || !("size" in file)) return formData;
  const f = file as File;
  if (f.size <= CSV_DIRECT_UPLOAD_MAX_BYTES) return formData;

  const prepared = await prepareCsvImportUploadAction();
  if (!prepared.ok) throw new Error(prepared.error || "Could not prepare upload");

  const put = await fetch(prepared.signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "text/csv",
      "x-upsert": "true",
    },
    body: f,
  });
  if (!put.ok) {
    throw new Error(`Could not stage CSV (${put.status})`);
  }

  const next = new FormData();
  for (const [key, value] of formData.entries()) {
    if (key === "csv") continue;
    next.append(key, value);
  }
  next.set("csvStoragePath", prepared.path);
  next.set("csvFileName", f.name || "upload.csv");
  return next;
}

export function MoveToGlowImport({
  actions,
  returnTo,
  hiddenFields,
  title = "Move to Glow",
  subtitle = "Coming from Square, Booksy, Timely, Fresha or Acuity? Bring everything across in three steps. Each step takes a CSV export from your old app.",
  importStatus,
  what,
  n,
  s,
  skipServices,
  skipDupes,
}: {
  actions: MoveToGlowImportActions;
  returnTo: string;
  hiddenFields?: Record<string, string>;
  title?: string;
  subtitle?: string;
  importStatus: string | null;
  what: string | null;
  n: string | null;
  s: string | null;
  skipServices?: string | null;
  skipDupes?: string | null;
}) {
  const router = useRouter();
  const hidden = Object.entries(hiddenFields ?? {});
  const skipServicesN = Number(skipServices) || 0;
  const skipDupesN = Number(skipDupes) || 0;

  const wrap = (action: (formData: FormData) => Promise<void>) => {
    return async (formData: FormData) => {
      try {
        const ready = await stageCsvIfNeeded(formData);
        await action(ready);
      } catch (e) {
        if (isNextRedirect(e)) throw e;
        console.error("[glow-import-client]", e);
        router.push(importResultUrl(returnTo, { import: "failed" }));
      }
    };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <FolderInput className="h-6 w-6 text-brand-400" /> {title}
        </h1>
        <p className="text-sm text-ink-soft">{subtitle}</p>
      </div>

      {importStatus === "done" && (
        <div className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">
          <p className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Imported {n} {what}
            {Number(s) > 0 &&
              ` (${s} skipped${
                skipServicesN > 0 || skipDupesN > 0
                  ? `: ${[
                      skipServicesN > 0 ? `${skipServicesN} unknown service` : "",
                      skipDupesN > 0 ? `${skipDupesN} duplicate` : "",
                      Number(s) - skipServicesN - skipDupesN > 0
                        ? `${Number(s) - skipServicesN - skipDupesN} other`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(", ")}`
                  : ": duplicates, unknown services, or missing details"
              })`}
            .
          </p>
          {skipServicesN > 0 && what === "appointments" && (
            <p className="mt-1 text-xs opacity-90">
              Most skips are unknown services — run Step 1 with this appointments file first (tick
              every calendar), then import appointments again.
            </p>
          )}
        </div>
      )}
      {importStatus === "badformat" && (
        <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-text">
          Couldn&apos;t recognise the columns in that file. Make sure it&apos;s the CSV export described below,
          or email it to support@glow-uk.com and we&apos;ll sort it for you.
        </div>
      )}
      {importStatus === "none" && (
        <div className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-text">
          No appointments were imported ({s} rows skipped
          {skipServicesN > 0 ? `, including ${skipServicesN} with no matching Glow service` : ""}
          ). Run Step 1 (services) with the Acuity appointments file first — tick every staff
          calendar — then try appointments again. Or email the file to support@glow-uk.com.
        </div>
      )}
      {importStatus === "empty" && (
        <div className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-text">That file looks empty.</div>
      )}
      {importStatus === "failed" && (
        <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-text">
          Something in that file tripped us up. It has been logged on our side, so we are already
          looking at it. Please email the file to support@glow-uk.com and we will import it for you.
        </div>
      )}
      {importStatus === "nocalendar" && (
        <div className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-text">
          That Acuity file has more than one staff calendar. Tick whose appointments to import, then try again.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scissors className="h-4 w-4 text-brand-400" /> Step 1 · Services &amp; price list
          </CardTitle>
          <CardDescription>
            Creates services with prices, durations and categories. Needs columns like
            &quot;Service name&quot;, &quot;Price&quot;, &quot;Duration&quot; (category and description picked up if present).
            Deposits use the account default percentage; fine-tune each service afterwards.
            Coming from Acuity? It does not export services separately, so upload the
            appointments export here instead: each appointment Type becomes a service, with
            Appointment Price when present. If the file has more than one Calendar, tick every
            staff member whose services you want on the price list. Check durations afterwards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={wrap(actions.importServices)} className="space-y-1">
            {hidden.map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <input
                id="servicesCsv"
                type="file"
                name="csv"
                accept=".csv,text/csv"
                required
                className={fileInputClass}
              />
              <SubmitButton variant="secondary" pendingLabel="Importing…">
                Import services
              </SubmitButton>
            </div>
            <ImportPreview inputId="servicesCsv" kind="services" />
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-400" /> Step 2 · Clients
          </CardTitle>
          <CardDescription>
            Brings the client list across: names, emails, phone numbers and notes. Duplicates
            (matching email) are skipped automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={wrap(actions.importClients)} className="space-y-1">
            {hidden.map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <input type="hidden" name="back" value={returnTo} />
            <div className="flex flex-wrap items-center gap-3">
              <input
                id="clientsCsv"
                type="file"
                name="csv"
                accept=".csv,text/csv"
                required
                className={fileInputClass}
              />
              <SubmitButton variant="secondary" pendingLabel="Importing…">
                Import clients
              </SubmitButton>
            </div>
            <ImportPreview inputId="clientsCsv" kind="clients" />
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-brand-400" /> Step 3 · Appointments
          </CardTitle>
          <CardDescription>
            Import after services and clients. Needs columns like &quot;Client&quot;, &quot;Service&quot; (or
            &quot;Services&quot; from Fresha) and &quot;Date&quot; / &quot;Scheduled date&quot; (Fresha also puts the
            full time in &quot;Scheduled time&quot; or &quot;Start time&quot;). Past appointments load as history;
            future ones are confirmed with quiet reminders — no emails are sent to clients during import.
            Rows with services we can&apos;t match are skipped and counted. Acuity Calendar names
            are matched to Glow team members so each diary stays with the right person.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={wrap(actions.importBookings)} className="space-y-1">
            {hidden.map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <input
                id="appointmentsCsv"
                type="file"
                name="csv"
                accept=".csv,text/csv"
                required
                className={fileInputClass}
              />
              <SubmitButton variant="secondary" pendingLabel="Importing…">
                Import appointments
              </SubmitButton>
            </div>
            <ImportPreview inputId="appointmentsCsv" kind="appointments" />
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Where to find exports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-ink-soft">
          <p>
            <strong className="text-ink">Square:</strong> Dashboard → Customers → Import/Export → Export; Items
            &amp; Services → Actions → Export library.
          </p>
          <p>
            <strong className="text-ink">Fresha:</strong> Sales → Appointments → pick your date range → Export →
            CSV (needs Client, Services and Scheduled date/time columns). Privacy export works too.
          </p>
          <p>
            <strong className="text-ink">Timely:</strong> Setup → Data export → Customers / Appointments.
          </p>
          <p>
            <strong className="text-ink">Booksy:</strong> Clients → ⋯ menu → Export client list (email their
            support for appointment exports).
          </p>
          <p>
            <strong className="text-ink">Acuity:</strong> Clients → Import/export → Export client list (choose
            All clients); appointments via Reports → Import/export → pick your date range, choose whether to
            include cancelled appointments, then Export Appointments. Acuity has no services export, so use
            the appointments file for Step 1 too. If the export has more than one Calendar (staff member),
            tick each person to import — Glow matches Calendar names to team members and puts appointments
            on the right diary. Start/End Time are read as long-form dates with the Timezone column.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
