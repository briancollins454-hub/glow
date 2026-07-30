import { PLATFORM_TZ } from "@/lib/locale";
import Link from "next/link";
import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { OwnerOmniSearch } from "@/components/owner/owner-omni-search";
import { getMoneySnapshot } from "@/lib/owner/money";
import { gbpFromPennies } from "@/lib/owner/mrr";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ reconcile?: string }>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const reconcile = sp.reconcile === "1";
  const data = await getMoneySnapshot({ reconcileStripe: reconcile });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Money</h1>
          <p className="text-sm text-ink-soft">
            Glow subscription MRR vs Stripe, and client Connect volume vs payments.
          </p>
        </div>
        <div className="flex gap-2">
          <OwnerOmniSearch />
          <Link
            href={reconcile ? "/dashboard/admin/money" : "/dashboard/admin/money?reconcile=1"}
            className="rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            {reconcile ? "Hide Stripe detail" : "Reconcile now (Stripe)"}
          </Link>
        </div>
      </div>
      <OwnerNav />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Glow MRR" value={gbpFromPennies(data.glow.mrr.mrrPennies)} />
        <Tile label="Paying accounts" value={String(data.glow.mrr.payingCount)} />
        <Tile label="Connect GMV (lifetime)" value={gbpFromPennies(data.connect.lifetimeGmvPennies)} />
        <Tile label="Connect GMV (month)" value={gbpFromPennies(data.connect.monthGmvPennies)} />
      </div>
      <p className="text-xs text-ink-faint">{data.glowLifetimeEstimateNote}</p>
      <p className="text-xs text-ink-faint">{data.connect.note}</p>

      <section className="rounded-xl border border-edge bg-surface p-4">
        <h2 className="font-display text-lg font-semibold">Glow subscriptions</h2>
        <p className="text-xs text-ink-faint">{data.glow.stripeReconcileNote}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="text-xs text-ink-faint">
              <tr>
                <th className="py-1">Account</th>
                <th>Status</th>
                <th>MRR</th>
                <th>Stripe</th>
                <th>Period end</th>
                <th>Flag</th>
              </tr>
            </thead>
            <tbody>
              {data.glow.rows
                .filter((r) => r.tech.subscriptionStatus !== "none")
                .slice(0, 100)
                .map((r) => (
                  <tr key={r.tech.id} className="border-t border-edge">
                    <td className="py-1.5">
                      <Link href={`/dashboard/admin/accounts/${r.tech.id}`} className="hover:underline">
                        {r.tech.businessName || r.tech.handle}
                      </Link>
                    </td>
                    <td>{r.tech.subscriptionStatus}</td>
                    <td>{r.mrrPennies ? gbpFromPennies(r.mrrPennies) : "—"}</td>
                    <td>{r.stripeStatus ?? "—"}</td>
                    <td>{r.tech.currentPeriodEnd ? fmtDate(r.tech.currentPeriodEnd, PLATFORM_TZ) : "—"}</td>
                    <td>
                      {r.mismatch ? <Badge tone="amber">{r.mismatch}</Badge> : null}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-edge bg-surface p-4">
        <h2 className="font-display text-lg font-semibold">Client Connect volume</h2>
        <p className="text-xs text-ink-faint">
          New Connect accounts often wait 7–14 days for the first payout — that is normal, not a fault.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs text-ink-faint">
              <tr>
                <th className="py-1">Account</th>
                <th>Glow payments</th>
                <th>Stripe sample</th>
                <th>Available</th>
                <th>Pending</th>
                <th>In transit</th>
                <th>Payouts</th>
                <th>Age</th>
                <th>Flag</th>
              </tr>
            </thead>
            <tbody>
              {data.connect.rows.slice(0, 80).map((r) => (
                <tr key={r.tech.id} className="border-t border-edge">
                  <td className="py-1.5">
                    <Link href={`/dashboard/admin/accounts/${r.tech.id}`} className="hover:underline">
                      {r.tech.businessName || r.tech.handle}
                    </Link>
                  </td>
                  <td>
                    {gbpFromPennies(r.paymentsGmvPennies)} ({r.paymentsCount})
                  </td>
                  <td>{r.stripeChargesPennies == null ? "—" : gbpFromPennies(r.stripeChargesPennies)}</td>
                  <td>
                    {r.balanceAvailablePennies == null ? "—" : gbpFromPennies(r.balanceAvailablePennies)}
                  </td>
                  <td>
                    {r.balancePendingPennies == null ? "—" : gbpFromPennies(r.balancePendingPennies)}
                  </td>
                  <td>
                    {r.payoutInTransitPennies == null ? "—" : gbpFromPennies(r.payoutInTransitPennies)}
                    {r.nextPayoutEta ? (
                      <span className="ml-1 text-xs text-ink-faint">eta {fmtDate(r.nextPayoutEta, PLATFORM_TZ)}</span>
                    ) : null}
                  </td>
                  <td>
                    {r.payoutsEnabled ? (
                      <Badge tone="green">Enabled</Badge>
                    ) : (
                      <Badge tone="amber">Pending</Badge>
                    )}
                    {r.accountAgeDays < 14 ? (
                      <span className="ml-1 text-xs text-ink-faint">first payout 7–14d</span>
                    ) : null}
                  </td>
                  <td>{r.accountAgeDays}d</td>
                  <td>{r.mismatch ? <Badge tone="amber">{r.mismatch}</Badge> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-4">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
