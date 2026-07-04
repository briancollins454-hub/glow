import { redirect } from "next/navigation";
import { Users, Scissors, CalendarDays, CheckCircle2, FolderInput } from "lucide-react";
import { getDashboardContext } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { ImportPreview } from "@/components/dashboard/import-preview";
import { importClientsAction, importServicesAction, importBookingsAction } from "../actions";

const fileInputClass =
  "text-sm text-ink-soft file:mr-2 file:rounded-lg file:border-0 file:bg-brand-500/15 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-300";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ import?: string; what?: string; n?: string; s?: string }>;
}) {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  const sp = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <FolderInput className="h-6 w-6 text-brand-400" /> Move to Glow
        </h1>
        <p className="text-sm text-ink-soft">
          Coming from Square, Booksy, Timely or Fresha? Bring everything across in three steps.
          Each step takes a CSV export from your old app.
        </p>
      </div>

      {sp.import === "done" && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Imported {sp.n} {sp.what}
          {Number(sp.s) > 0 && ` (${sp.s} skipped: duplicates, unknown services, or missing details)`}.
        </div>
      )}
      {sp.import === "badformat" && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Couldn&apos;t recognise the columns in that file. Make sure it&apos;s the CSV export described below,
          or email it to support@glow-uk.com and we&apos;ll sort it for you.
        </div>
      )}
      {sp.import === "empty" && (
        <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-300">That file looks empty.</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Scissors className="h-4 w-4 text-brand-400" /> Step 1 · Services &amp; price list</CardTitle>
          <CardDescription>
            Creates your services with prices, durations and categories. Needs columns like
            &quot;Service name&quot;, &quot;Price&quot;, &quot;Duration&quot; (category and description picked up if present).
            Deposits use your default percentage; fine-tune each service afterwards.
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
            Import after services and clients. Needs columns like &quot;Client&quot;, &quot;Service&quot; and
            &quot;Date&quot; (plus &quot;Time&quot; or &quot;Status&quot; if your export has them). Past appointments load as
            history; future ones are confirmed with quiet reminders - no emails are sent to
            clients during import. Rows with services we can&apos;t match are skipped and counted.
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
          <p><strong className="text-ink">Fresha:</strong> Settings → Data &amp; privacy → Export data (clients and appointments CSVs).</p>
          <p><strong className="text-ink">Timely:</strong> Setup → Data export → Customers / Appointments.</p>
          <p><strong className="text-ink">Booksy:</strong> Clients → ⋯ menu → Export client list (email their support for appointment exports).</p>
          <p className="pt-1 text-xs text-ink-faint">
            Stuck with a weird file? Email it to support@glow-uk.com and we&apos;ll import it for you.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
