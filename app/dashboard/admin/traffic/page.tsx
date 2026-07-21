import Link from "next/link";
import { requireOwner } from "@/lib/owner/require-owner";
import { getPlatformTraffic } from "@/lib/traffic-stats";
import { OwnerNav } from "@/components/owner/owner-nav";
import { MetricTile } from "@/components/owner/metric-tile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OwnerTrafficPage() {
  await requireOwner();
  const traffic = await getPlatformTraffic();

  const conv7 =
    traffic.last7Days.visitors > 0
      ? `${((traffic.signups.last7Days / traffic.last7Days.visitors) * 100).toFixed(1)}%`
      : "Unavailable";
  const conv30 =
    traffic.last30Days.visitors > 0
      ? `${((traffic.signups.last30Days / traffic.last30Days.visitors) * 100).toFixed(1)}%`
      : "Unavailable";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Traffic and acquisition</h1>
        <p className="text-sm text-ink-soft">
          Counts real browser visits (PageViewBeacon → /api/t). ISR-cached pages no longer under-count.
          Pre-fix history cannot be recovered.
        </p>
      </div>
      <OwnerNav />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Today views" value={traffic.today.views.toLocaleString()} hint={`${traffic.today.visitors} unique`} />
        <MetricTile label="7d views" value={traffic.last7Days.views.toLocaleString()} hint={`${traffic.last7Days.visitors} unique`} />
        <MetricTile label="30d views" value={traffic.last30Days.views.toLocaleString()} hint={`${traffic.last30Days.visitors} unique`} />
        <MetricTile label="All time" value={traffic.allTime.views.toLocaleString()} hint={`${traffic.allTime.visitors} unique`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Signups (7d)" value={String(traffic.signups.last7Days)} />
        <MetricTile label="Visit → signup (7d)" value={conv7} hint="signups / unique visitors" />
        <MetricTile label="Signups (30d)" value={String(traffic.signups.last30Days)} />
        <MetricTile label="Visit → signup (30d)" value={conv30} hint="signups / unique visitors" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily (last 30 days)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {traffic.daily.length === 0 ? (
            <p className="text-sm text-ink-faint">No visits recorded yet since the tracking fix.</p>
          ) : (
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead className="text-xs text-ink-faint">
                <tr>
                  <th className="px-2 py-1">Date</th>
                  <th className="px-2 py-1">Views</th>
                  <th className="px-2 py-1">Visitors</th>
                </tr>
              </thead>
              <tbody>
                {traffic.daily.map((row) => (
                  <tr key={row.day} className="border-t border-edge">
                    <td className="px-2 py-1.5">{fmtDate(`${row.day}T12:00:00.000Z`)}</td>
                    <td className="px-2 py-1.5">{row.views}</td>
                    <td className="px-2 py-1.5">{row.visitors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top pages (30d)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {traffic.topPaths.length === 0 ? (
              <p className="text-sm text-ink-faint">None yet.</p>
            ) : (
              traffic.topPaths.map((row) => (
                <div key={row.path} className="flex justify-between rounded-lg border border-edge px-3 py-2 text-sm">
                  <span className="font-medium">{row.path}</span>
                  <span className="text-ink-faint">{row.views} · {row.visitors} uniq</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top booking pages (30d)</CardTitle>
            <CardDescription>Per-tech public page traffic</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {traffic.topTechs.length === 0 ? (
              <p className="text-sm text-ink-faint">None yet.</p>
            ) : (
              traffic.topTechs.map((row) => (
                <div key={row.techId} className="flex justify-between rounded-lg border border-edge px-3 py-2 text-sm">
                  <div>
                    <Link href={`/dashboard/admin/accounts/${row.techId}`} className="font-medium hover:underline">
                      {row.businessName}
                    </Link>
                    <p className="text-xs text-ink-faint">/{row.handle}</p>
                  </div>
                  <span className="text-ink-faint">{row.views} · {row.visitors} uniq</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Referrers (30d)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {traffic.topReferrers.length === 0 ? (
              <p className="text-sm text-ink-faint">None yet (or migration 0044 RPCs not applied).</p>
            ) : (
              traffic.topReferrers.map((row) => (
                <div key={row.referrer} className="flex justify-between gap-3 rounded-lg border border-edge px-3 py-2 text-sm">
                  <span className="truncate font-medium">{row.referrer}</span>
                  <span className="shrink-0 text-ink-faint">{row.views}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>UTM sources (30d)</CardTitle>
            <CardDescription>Captured from utm_source on public pages</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {traffic.topSources.length === 0 ? (
              <p className="text-sm text-ink-faint">None yet (or migration 0044 RPCs not applied).</p>
            ) : (
              traffic.topSources.map((row) => (
                <div key={row.source} className="flex justify-between rounded-lg border border-edge px-3 py-2 text-sm">
                  <span className="font-medium">{row.source}</span>
                  <span className="text-ink-faint">{row.views}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
