import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { getAttributionReport, type FunnelBucket } from "@/lib/owner/attribution";

export const dynamic = "force-dynamic";

function FunnelTable({ title, rows }: { title: string; rows: FunnelBucket[] }) {
  return (
    <section className="rounded-xl border border-edge bg-surface p-4">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="text-xs text-ink-faint">
            <tr>
              <th className="py-1">Key</th>
              <th>Visits</th>
              <th>Signups</th>
              <th>Activated</th>
              <th>Paying</th>
              <th>Visit→signup</th>
              <th>Signup→activated</th>
              <th>Activated→paying</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.dimension}-${r.key}`} className="border-t border-edge">
                <td className="py-1.5">{r.key}</td>
                <td>{r.visits}</td>
                <td>{r.signups}</td>
                <td>{r.activated}</td>
                <td>{r.paying}</td>
                <td>{r.visitToSignupPct}%</td>
                <td>{r.signupToActivatedPct}%</td>
                <td>{r.activatedToPayingPct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function AttributionPage() {
  await requireOwner();
  const data = await getAttributionReport();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Attribution</h1>
        <p className="text-sm text-ink-soft">
          Which channel actually works: visits → signups → activated → paying.
        </p>
        <p className="text-xs text-ink-faint">{data.note}</p>
      </div>
      <OwnerNav />

      <div className="grid gap-3 sm:grid-cols-4">
        <Tile label="Visits (sampled)" value={String(data.totals.visits)} />
        <Tile label="Signups" value={String(data.totals.signups)} />
        <Tile label="Activated" value={String(data.totals.activated)} />
        <Tile label="Paying" value={String(data.totals.paying)} />
      </div>

      <FunnelTable title="By UTM source" rows={data.bySource} />
      <FunnelTable title="By UTM medium" rows={data.byMedium} />
      <FunnelTable title="By UTM campaign" rows={data.byCampaign} />
      <FunnelTable title="By partner" rows={data.byPartner} />
      <FunnelTable title="How did you hear about us" rows={data.byHeardAbout} />
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
