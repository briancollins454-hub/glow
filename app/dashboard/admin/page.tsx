import { Crown } from "lucide-react";
import { requireOwner } from "@/lib/owner/require-owner";
import { getOwnerOverview, type MetricValue } from "@/lib/owner/overview";
import { gbpFromPennies } from "@/lib/owner/mrr";
import { OwnerNav } from "@/components/owner/owner-nav";
import { AsOf, MetricTile, formatMetric, metricReason } from "@/components/owner/metric-tile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ownerRefreshCacheAction } from "./owner-actions";

export const dynamic = "force-dynamic";

function tile(m: MetricValue, money = false) {
  return {
    value: formatMetric(m, { money }),
    hint: metricReason(m),
  };
}

export default async function OwnerOverviewPage() {
  await requireOwner();
  const o = await getOwnerOverview();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
            <Crown className="h-6 w-6 text-brand-400" /> Owner console
          </h1>
          <p className="text-sm text-ink-soft">Platform overview. Every number is scoped from source tables.</p>
          <AsOf iso={o.generatedAt} ttlSeconds={o.ttlSeconds} />
        </div>
        <form action={ownerRefreshCacheAction}>
          <button type="submit" className="rounded-xl border border-edge bg-cream px-3 py-2 text-sm font-medium hover:border-brand-400/40">
            Refresh tiles
          </button>
        </form>
      </div>

      <OwnerNav />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Accounts</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile label="Total accounts" value={String(o.accountsTotal)} hint={`${o.testers} tester offer`} />
          <MetricTile label="Paying (active)" value={String(o.paying)} hint="subscriptionStatus=active only" tone="green" />
          <MetricTile label="Trialing" value={String(o.trialing)} tone="amber" />
          <MetricTile label="Complimentary" value={String(o.complimentary)} hint="comped" tone="neutral" />
          <MetricTile label="Cancelled" value={String(o.cancelled)} tone="red" />
          <MetricTile label="Past due" value={String(o.pastDue)} tone="amber" />
          <MetricTile label="Staff (all accounts)" {...tile(o.staffTotal)} />
          <MetricTile label="Clients (all accounts)" {...tile(o.clientsTotal)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Bookings and client payments</h2>
        <p className="text-sm text-ink-soft">
          GMV is client payment volume through Stripe Connect. Glow takes 0% of it. It is not Glow revenue.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile label="Bookings (all time)" {...tile(o.bookingsAllTime)} />
          <MetricTile label="Bookings (this month)" {...tile(o.bookingsThisMonth)} />
          <MetricTile label="Bookings (today)" {...tile(o.bookingsToday)} />
          <MetricTile
            label="Client GMV (Connect)"
            {...tile(o.gmvPennies, true)}
            hint={metricReason(o.gmvPennies) ?? "succeeded deposit + balance + no-show fees"}
            tone="neutral"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Glow revenue</h2>
        <p className="text-sm text-ink-soft">{o.mrr.note}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile label="MRR" value={gbpFromPennies(o.mrr.mrrPennies)} hint={`${o.mrr.payingCount} paying`} tone="green" />
          <MetricTile label="ARR" value={gbpFromPennies(o.mrr.arrPennies)} hint="MRR × 12" tone="green" />
          <MetricTile label="New paying (this month)" {...tile(o.newPayingThisMonth)} hint="active + signed up this month (proxy)" />
          <MetricTile
            label="Churned (this month)"
            {...tile(o.churnedThisMonth)}
            hint={metricReason(o.churnedThisMonth) ?? "canceled with period end this month"}
          />
          <MetricTile
            label="Trial → paid rate"
            value={o.trialToPaidRate.ok ? `${o.trialToPaidRate.value}%` : "Unavailable"}
            hint={metricReason(o.trialToPaidRate) ?? "active / (active + trialing)"}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Growth</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricTile label="Signups (24h)" value={String(o.signups.day)} />
          <MetricTile label="Signups (7d)" value={String(o.signups.week)} />
          <MetricTile label="Signups (30d)" value={String(o.signups.month)} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Activation funnel</CardTitle>
            <CardDescription>Signed up → added a service → took a booking → first paid booking</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            <MetricTile label="Signed up" value={String(o.activation.signedUp)} />
            <MetricTile label="Added a service" {...tile(o.activation.withService)} />
            <MetricTile label="Took a booking" {...tile(o.activation.withBooking)} />
            <MetricTile label="First paid booking" {...tile(o.activation.withPaidBooking)} />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">System health</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label="Last cron"
            value={o.health.lastCron ? (o.health.lastCron.ok ? "OK" : "Failed") : "None yet"}
            hint={
              o.health.lastCron
                ? `${o.health.lastCron.job} · ${o.health.lastCron.at}`
                : "Runs every 15 minutes after migration 0044"
            }
            tone={o.health.lastCron && !o.health.lastCron.ok ? "red" : "green"}
          />
          <Link href="/dashboard/admin/ops">
            <MetricTile label="Failed crons (24h)" {...tile(o.health.failedCrons24h)} tone="red" />
          </Link>
          <Link href="/dashboard/admin/ops">
            <MetricTile label="Send failures (24h)" {...tile(o.health.outboundFailures24h)} tone="amber" />
          </Link>
          <Link href="/dashboard/admin/ops">
            <MetricTile label="Errors (24h)" {...tile(o.health.errors24h)} tone="red" />
          </Link>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Traffic snapshot</CardTitle>
          <CardDescription>
            Real browser visits via client beacon. Historical traffic before the tracking fix cannot be recovered.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <MetricTile label="Today" value={String(o.traffic.today.views)} hint={`${o.traffic.today.visitors} visitors`} />
          <MetricTile label="7 days" value={String(o.traffic.last7Days.views)} hint={`${o.traffic.last7Days.visitors} visitors`} />
          <MetricTile label="30 days" value={String(o.traffic.last30Days.views)} hint={`${o.traffic.last30Days.visitors} visitors`} />
          <Link href="/dashboard/admin/traffic" className="text-sm font-medium text-brand-text underline-offset-2 hover:underline self-center">
            Open traffic →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
