import Link from "next/link";
import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { FEATURE_LABELS, getAdoptionMatrix, type FeatureKey } from "@/lib/owner/adoption";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdoptionPage() {
  await requireOwner();
  const data = await getAdoptionMatrix({ limit: 60 });
  const keys = Object.keys(FEATURE_LABELS) as FeatureKey[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Feature adoption</h1>
        <p className="text-sm text-ink-soft">
          Actual usage, not availability. Platform % shows what everyone depends on.
        </p>
        <p className="text-xs text-ink-faint">{data.note}</p>
      </div>
      <OwnerNav />

      <section className="overflow-x-auto rounded-xl border border-edge">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="bg-fill text-ink-faint">
            <tr>
              <th className="px-2 py-2">Feature</th>
              <th className="px-2 py-2">Platform %</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k} className="border-t border-edge">
                <td className="px-2 py-1.5">{FEATURE_LABELS[k]}</td>
                <td className="px-2 py-1.5">{data.platformPercent[k]}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded-xl border border-edge">
        <table className="w-full min-w-[1400px] text-left text-xs">
          <thead className="bg-fill text-ink-faint">
            <tr>
              <th className="sticky left-0 bg-fill px-2 py-2">Account</th>
              {keys.map((k) => (
                <th key={k} className="px-1 py-2" title={FEATURE_LABELS[k]}>
                  {FEATURE_LABELS[k].slice(0, 8)}
                </th>
              ))}
              <th className="px-2 py-2">Flags</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.tech.id} className="border-t border-edge">
                <td className="sticky left-0 bg-surface px-2 py-1">
                  <Link href={`/dashboard/admin/accounts/${row.tech.id}`} className="hover:underline">
                    {row.tech.businessName || row.tech.handle}
                  </Link>
                </td>
                {keys.map((k) => (
                  <td key={k} className="px-1 py-1 text-center">
                    {row.flags[k] ? "●" : "·"}
                    {k === "deposits" && row.flags.depositsPercent != null
                      ? ` ${row.flags.depositsPercent}%`
                      : ""}
                  </td>
                ))}
                <td className="px-2 py-1">
                  {row.suspicious.map((s) => (
                    <Badge key={s} tone="amber">
                      {s}
                    </Badge>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
