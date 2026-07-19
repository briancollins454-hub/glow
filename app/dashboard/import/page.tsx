"use client";

import { useSearchParams } from "next/navigation";
import { Users, Scissors, CalendarDays, CheckCircle2, FolderInput } from "lucide-react";
import { AsyncDashboardPage } from "@/components/dashboard/async-dashboard-page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { ImportPreview } from "@/components/dashboard/import-preview";
import { importClientsAction, importServicesAction, importBookingsAction } from "../actions";

const fileInputClass =
  "text-sm text-ink-soft file:mr-2 file:rounded-lg file:border-0 file:bg-brand-500/15 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-300";

export default function ImportPage() {
  return (
    <AsyncDashboardPage<Record<string, never>> pageKey="import">
      {() => <ImportView />}
    </AsyncDashboardPage>
  );
}

function ImportView() {
  const searchParams = useSearchParams();
  const importStatus = searchParams.get("import");
  const what = searchParams.get("what");
  const n = searchParams.get("n");
  const s = searchParams.get("s");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <FolderInput className="h-6 w-6 text-brand-400" /> Move to Glow
        </h1>
        <p className="text-sm text-ink-soft">
          Coming from Square, Booksy, Timely, Fresha or Acuity? Bring everything across in three steps.
          Each step takes a CSV export from your old app.
        </p>
      </div>

      {importStatus === "done" && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Imported {n} {what}
          {Number(s) > 0 && ` (${s} skipped: duplicates, unknown services, or missing details)`}.
        </div>
      )}
      {importStatus === "badformat" && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Couldn&apos;t recognise the columns in that file. Make sure it&apos;s the CSV export described below,
          or email it to support@glow-uk.com and we&apos;ll sort it for you.
        </div>
      )}
      {importStatus === "none" && (
        <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          No appointments were imported ({s} rows skipped). This usually means the dates couldn&apos;t be read,
          or the service names in the file don&apos;t exactly match your Glow services list. Try re-importing
          after the latest update, or email the file to support@glow-uk.com.
        </div>
      )}
      {importStatus === "empty" && (
        <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-300">That file looks empty.</div>
      )}
      {importStatus === "failed" && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Something in that file tripped us up. It has been logged on our side, so we are already
          looking at it. Please email the file to support@glow-uk.com and we will import it for you.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Scissors className="h-4 w-4 text-brand-400" /> Step 1 · Services &amp; price list</CardTitle>
          <CardDescription>
            Creates your services with prices, durations and categories. Needs columns like
            &quot;Service name&quot;, &quot;Price&quot;, &quot;Duration&quot; (category and description picked up if present).
            Deposits use your default percentage; fine-tune each service afterwards.
            Coming from Acuity? It does not export services separately, so upload your
            appointments export here instead: each appointment type becomes a service with a
            default price and duration for you to fill in afterwards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={importServicesAction} className="flex flex-wrap items-center gap-3">
            <input id="servicesCsv" type="file" name="csv" accept=".csv,text/csv" required className={fileInputClass} />
            <SubmitButton variant="secondary" pendingLabel="Importing…">Import services</SubmitButton>
          </form>
          <ImportPreview inputId="servicesCsv" kind="services" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4 text-brand-400" /> Step 2 · Clients</CardTitle>
          <CardDescription>
            Brings your client list across: names, emails, phone numbers and notes. Duplicates
            (matching email) are skipped automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={importClientsAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="back" value="/dashboard/import" />
            <input id="clientsCsv" type="file" name="csv" accept=".csv,text/csv" required className={fileInputClass} />
            <SubmitButton variant="secondary" pendingLabel="Importing…">Import clients</SubmitButton>
          </form>
          <ImportPreview inputId="clientsCsv" kind="clients" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-brand-400" /> Step 3 · Appointments</CardTitle>
          <CardDescription>
            Import after services and clients. Needs columns like &quot;Client&quot;, &quot;Service&quot; (or
            &quot;Services&quot; from Fresha) and &quot;Date&quot; / &quot;Scheduled date&quot; (Fresha also puts the
            full time in &quot;Scheduled time&quot; or &quot;Start time&quot;). Past appointments load as history;
            future ones are confirmed with quiet reminders — no emails are sent to clients during import.
            Rows with services we can&apos;t match are skipped and counted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={importBookingsAction} className="flex flex-wrap items-center gap-3">
            <input id="appointmentsCsv" type="file" name="csv" accept=".csv,text/csv" required className={fileInputClass} />
            <SubmitButton variant="secondary" pendingLabel="Importing…">Import appointments</SubmitButton>
          </form>
          <ImportPreview inputId="appointmentsCsv" kind="appointments" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Where to find your exports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-ink-soft">
          <p><strong className="text-ink">Square:</strong> Dashboard → Customers → Import/Export → Export; Items &amp; Services → Actions → Export library.</p>
          <p><strong className="text-ink">Fresha:</strong> Sales → Appointments → pick your date range → Export → CSV (needs Client, Services and Scheduled date/time columns). Privacy export works too.</p>
          <p><strong className="text-ink">Timely:</strong> Setup → Data export → Customers / Appointments.</p>
          <p><strong className="text-ink">Booksy:</strong> Clients → ⋯ menu → Export client list (email their support for appointment exports).</p>
          <p><strong className="text-ink">Acuity:</strong> Clients → Import/export → Export client list (choose All clients); appointments via Reports → Import/export → pick your date range, choose whether to include cancelled appointments, then Export Appointments. Acuity has no services export, so use the appointments file for Step 1 too. Acuity dates are read as US month-first (MM/DD/YYYY) automatically.</p>
          <p className="pt-1 text-xs text-ink-faint">
            Stuck with a weird file? Email it to support@glow-uk.com and we&apos;ll import it for you.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
