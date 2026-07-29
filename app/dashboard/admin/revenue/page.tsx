import Link from "next/link";
import { requireOwner } from "@/lib/owner/require-owner";
import { getRevenueSnapshot } from "@/lib/owner/revenue";
import { getCohortRevenueExtras } from "@/lib/owner/cohorts";
import { gbpFromPennies } from "@/lib/owner/mrr";
import { OwnerNav } from "@/components/owner/owner-nav";
import { MetricTile } from "@/components/owner/metric-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OwnerRevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ reconcile?: string }>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const reconcile = sp.reconcile === "1";
  const [snap, cohorts] = await Promise.all([
    getRevenueSnapshot({ reconcileStripe: reconcile }),
    getCohortRevenueExtras(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Revenue and billing</h1>
          <p className="text-sm text-ink-soft">
            Glow subscription revenue only. Client Connect GMV is separate and is not shown as yours.
          </p>
        </div>
        <Link
          href={reconcile ? "/dashboard/admin/revenue" : "/dashboard/admin/revenue?reconcile=1"}
          className="rounded-xl border border-edge bg-cream px-3 py-2 text-sm font-medium hover:border-brand-400/40"
        >
          {reconcile ? "Hide Stripe reconcile" : "Refresh from Stripe"}
        </Link>
      </div>
      <OwnerNav />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="MRR" value={gbpFromPennies(snap.mrr.mrrPennies)} hint={snap.mrr.note} tone="green" />
        <MetricTile label="ARR" value={gbpFromPennies(snap.mrr.arrPennies)} tone="green" />
        <MetricTile label="Paying monthly" value={String(snap.mrr.payingMonthly)} />
        <MetricTile label="Paying annual" value={String(snap.mrr.payingAnnual)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Expected from trials"
          value={gbpFromPennies(cohorts.forecast.expectedFromTrialsPennies)}
          hint={`Observed conversion ${cohorts.forecast.observedTrialConversionRate}%`}
        />
        <MetricTile
          label="MRR at risk"
          value={gbpFromPennies(cohorts.forecast.atRiskMrrPennies)}
          tone="amber"
          hint="Past due + at-risk"
        />
        <MetricTile
          label="LTV estimate"
          value={
            cohorts.forecast.ltvPennies == null
              ? "Unavailable"
              : gbpFromPennies(cohorts.forecast.ltvPennies)
          }
          hint={cohorts.forecast.ltvNote}
        />
        <MetricTile
          label="Avg lifetime"
          value={
            cohorts.forecast.avgLifetimeMonths == null
              ? "—"
              : `${cohorts.forecast.avgLifetimeMonths} mo`
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Retention grid</CardTitle>
          <CardDescription>{cohorts.retention.note}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {cohorts.retention.signupMonths.length === 0 ? (
            <p className="text-sm text-ink-faint">No cohorts yet.</p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="text-ink-faint">
                <tr>
                  <th className="px-2 py-1">Signup month</th>
                  {Array.from({ length: cohorts.retention.maxAge + 1 }, (_, i) => (
                    <th key={i} className="px-2 py-1">
                      M{i}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohorts.retention.signupMonths.slice(-12).map((sm) => (
                  <tr key={sm} className="border-t border-edge">
                    <td className="px-2 py-1 font-medium">{sm}</td>
                    {Array.from({ length: cohorts.retention.maxAge + 1 }, (_, i) => {
                      const cell = cohorts.retention.cells[sm]?.[i];
                      return (
                        <td key={i} className="px-2 py-1">
                          {cell ? `${cell.accounts} / ${gbpFromPennies(cell.mrrPennies)}` : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>MRR movement</CardTitle>
          <CardDescription>New, expansion, contraction, churned, net — from snapshots.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {cohorts.movement.length === 0 ? (
            <p className="text-sm text-ink-faint">Need at least two snapshot months.</p>
          ) : (
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="text-xs text-ink-faint">
                <tr>
                  <th className="py-1">Month</th>
                  <th>New</th>
                  <th>Expansion</th>
                  <th>Contraction</th>
                  <th>Churned</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.movement.map((m) => (
                  <tr key={m.month} className="border-t border-edge">
                    <td className="py-1.5">{m.month}</td>
                    <td>{gbpFromPennies(m.newPennies)}</td>
                    <td>{gbpFromPennies(m.expansionPennies)}</td>
                    <td>{gbpFromPennies(m.contractionPennies)}</td>
                    <td>{gbpFromPennies(m.churnedPennies)}</td>
                    <td>{gbpFromPennies(m.netPennies)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-ink-soft">{snap.promoNote}</p>
      <p className="text-sm text-ink-soft">{snap.stripeReconcileNote}</p>

      {snap.pastDue.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Past due / failed payments</CardTitle>
            <CardDescription>Involuntary churn risk from Glow&apos;s subscriptionStatus</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {snap.pastDue.map((row) => (
              <Link
                key={row.tech.id}
                href={`/dashboard/admin/accounts/${row.tech.id}`}
                className="flex justify-between rounded-lg border border-edge px-3 py-2 text-sm hover:border-brand-400/40"
              >
                <span>
                  {row.tech.businessName} · {row.tech.email}
                </span>
                <Badge tone="amber">past_due</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Subscriptions</CardTitle>
          <CardDescription>
            List MRR uses active + plan only. Stripe columns fill when you run Refresh from Stripe.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="text-xs text-ink-faint">
              <tr>
                <th className="px-2 py-1">Account</th>
                <th className="px-2 py-1">Glow status</th>
                <th className="px-2 py-1">Plan</th>
                <th className="px-2 py-1">List MRR</th>
                <th className="px-2 py-1">Period end</th>
                <th className="px-2 py-1">Stripe status</th>
                <th className="px-2 py-1">Stripe amount</th>
                <th className="px-2 py-1">Mismatch</th>
              </tr>
            </thead>
            <tbody>
              {snap.rows.map((row) => (
                <tr key={row.tech.id} className="border-t border-edge">
                  <td className="px-2 py-1.5">
                    <Link href={`/dashboard/admin/accounts/${row.tech.id}`} className="font-medium hover:underline">
                      {row.tech.businessName || row.tech.handle}
                    </Link>
                    <p className="text-xs text-ink-faint">{row.tech.email}</p>
                  </td>
                  <td className="px-2 py-1.5">{row.tech.subscriptionStatus}</td>
                  <td className="px-2 py-1.5">
                    {row.tech.plan ?? "—"}
                    {row.tech.signupOffer === "tester" ? " · tester" : ""}
                    {row.tech.subscriptionStatus === "comped" ? " · comp" : ""}
                  </td>
                  <td className="px-2 py-1.5">{row.mrrPennies ? gbpFromPennies(row.mrrPennies) : "—"}</td>
                  <td className="px-2 py-1.5">
                    {row.tech.currentPeriodEnd ? fmtDate(row.tech.currentPeriodEnd) : "—"}
                  </td>
                  <td className="px-2 py-1.5">{row.stripeStatus ?? "—"}</td>
                  <td className="px-2 py-1.5">
                    {row.stripeAmountPennies != null ? gbpFromPennies(row.stripeAmountPennies) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-danger-text">{row.mismatch ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
