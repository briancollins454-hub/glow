"use client";

import { useMemo, useState } from "react";
import { Download, FileText, PoundSterling, CheckCircle2, XCircle, ShieldX } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { AsyncDashboardPage } from "@/components/dashboard/async-dashboard-page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { gbp, TZ } from "@/lib/format";
import { selectableTaxYears } from "@/lib/tax-year";
import type { ReportSummary } from "@/lib/db/queries";

export default function ReportsPage() {
  return (
    <AsyncDashboardPage<ReportSummary> pageKey="reports">
      {(data) => <ReportsView {...data} />}
    </AsyncDashboardPage>
  );
}

function ReportsView({
  totalIncome,
  depositsTotal,
  balancesTotal,
  completed,
  noShows,
  forfeited,
  byMonth: months,
  byService: svcRows,
}: ReportSummary) {
  const taxYears = useMemo(() => selectableTaxYears(), []);
  const [taxYear, setTaxYear] = useState(() => taxYears[0]!.startYear);
  const maxService = Math.max(1, ...svcRows.map(([, v]) => v));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Tax &amp; income</h1>
          <p className="text-sm text-ink-soft">
            A simple view for your Self Assessment. Download a tax-year PDF pack or export raw CSV.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-ink-soft">
            Tax year{" "}
            <select
              value={taxYear}
              onChange={(e) => setTaxYear(parseInt(e.target.value, 10))}
              className="ml-1 rounded-lg border border-edge bg-cream px-2 py-1.5 text-sm text-ink"
            >
              {taxYears.map((y) => (
                <option key={y.startYear} value={y.startYear}>
                  {y.label}
                </option>
              ))}
            </select>
          </label>
          <ButtonLink href={`/api/reports/tax-pack?year=${taxYear}`} variant="secondary">
            <FileText className="h-4 w-4" /> Tax pack PDF
          </ButtonLink>
          <ButtonLink href="/api/reports/export" variant="outline">
            <Download className="h-4 w-4" /> Export CSV
          </ButtonLink>
        </div>
      </div>

      <Card className="border-brand-500/20 bg-brand-500/5">
        <CardContent className="p-4 text-sm text-ink-soft">
          <strong className="text-ink">Self Assessment tax pack</strong> — PDF summary for the UK tax year
          (6 April – 5 April): turnover, monthly breakdown, income by service, and every payment transaction.
          Not tax advice — check against your Stripe payouts and keep expense receipts.
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={PoundSterling} tone="green" label="Total income" value={gbp(totalIncome)} />
        <Stat icon={CheckCircle2} tone="blue" label="Completed" value={String(completed)} />
        <Stat icon={XCircle} tone="amber" label="No-shows" value={String(noShows)} />
        <Stat icon={ShieldX} tone="red" label="Forfeited deposits" value={gbp(forfeited)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Income by month</CardTitle>
            <CardDescription>Deposits {gbp(depositsTotal)} · balances {gbp(balancesTotal)}</CardDescription>
          </CardHeader>
          <CardContent>
            {months.length === 0 ? (
              <p className="text-sm text-ink-faint">No income recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {months.map(([m, total]) => (
                    <tr key={m} className="border-b border-edge last:border-0">
                      <td className="py-2.5 text-ink-soft">{formatInTimeZone(new Date(`${m}-01T12:00:00Z`), TZ, "MMMM yyyy")}</td>
                      <td className="py-2.5 text-right font-medium">{gbp(total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Income by service</CardTitle>
            <CardDescription>Where your money comes from.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {svcRows.length === 0 ? (
              <p className="text-sm text-ink-faint">No income recorded yet.</p>
            ) : (
              svcRows.map(([name, total]) => (
                <div key={name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-ink-soft">{name}</span>
                    <span className="font-medium">{gbp(total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(total / maxService) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, tone, label, value }: { icon: React.ComponentType<{ className?: string }>; tone: "green" | "blue" | "amber" | "red"; label: string; value: string }) {
  const tones = { green: "text-emerald-400", blue: "text-sky-400", amber: "text-amber-400", red: "text-red-400" };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <Icon className={`h-8 w-8 ${tones[tone]}`} />
        <div>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-sm text-ink-soft">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
