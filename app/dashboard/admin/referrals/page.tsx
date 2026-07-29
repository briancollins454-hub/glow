import Link from "next/link";
import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { getReferralsSnapshot, partnerStatementCsv } from "@/lib/owner/referrals";
import { gbpFromPennies } from "@/lib/owner/mrr";
import { addPartnerLedgerAction } from "../phase2-actions";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReferralsPage() {
  await requireOwner();
  const data = await getReferralsSnapshot();
  const quarter = `${new Date().getUTCFullYear()}-Q${Math.floor(new Date().getUTCMonth() / 3) + 1}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Referrals and partners</h1>
        <p className="text-sm text-ink-soft">
          Referral graph, soft fraud review flags, and partner commission ledger.
        </p>
      </div>
      <OwnerNav />

      {data.fraud.length > 0 ? (
        <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <h2 className="font-display text-lg font-semibold">Fraud review flags</h2>
          <p className="text-xs text-ink-faint">Flagged for review — never auto-blocked.</p>
          <ul className="mt-2 space-y-1 text-sm">
            {data.fraud.slice(0, 40).map((f, i) => (
              <li key={`${f.rule}-${i}`}>
                <Badge tone="amber">{f.rule}</Badge> {f.title} — {f.detail}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-edge bg-surface p-4">
        <h2 className="font-display text-lg font-semibold">Referral graph</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="text-xs text-ink-faint">
              <tr>
                <th className="py-1">Referrer</th>
                <th>Referred</th>
                <th>Credit granted</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {data.edges.slice(0, 100).map((e) => (
                <tr key={e.referredId} className="border-t border-edge">
                  <td className="py-1.5">
                    <Link href={`/dashboard/admin/accounts/${e.referrerId}`} className="hover:underline">
                      /{e.referrerHandle}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/dashboard/admin/accounts/${e.referredId}`} className="hover:underline">
                      {e.referredLabel}
                    </Link>
                  </td>
                  <td>{e.creditGrantedAt ? fmtDate(e.creditGrantedAt) : "—"}</td>
                  <td>
                    {e.fraudFlags.map((f) => (
                      <Badge key={f} tone="amber">
                        {f}
                      </Badge>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-edge bg-surface p-4">
        <h2 className="font-display text-lg font-semibold">Partner ledger</h2>
        <form action={addPartnerLedgerAction} className="mt-3 flex flex-wrap items-end gap-2">
          <input
            name="partnerSlug"
            placeholder="partner slug"
            className="rounded-lg border border-edge px-2 py-1.5 text-sm"
          />
          <select name="kind" className="rounded-lg border border-edge px-2 py-1.5 text-sm">
            <option value="commission_owed">Commission owed</option>
            <option value="commission_paid">Commission paid</option>
            <option value="adjustment">Adjustment</option>
          </select>
          <input
            name="amount"
            type="number"
            step="0.01"
            placeholder="£"
            className="w-24 rounded-lg border border-edge px-2 py-1.5 text-sm"
          />
          <input
            name="note"
            placeholder="Note"
            className="min-w-[140px] flex-1 rounded-lg border border-edge px-2 py-1.5 text-sm"
          />
          <input
            name="confirm"
            placeholder="yes"
            className="w-16 rounded-lg border border-edge px-2 py-1.5 text-sm"
            autoComplete="off"
          />
          <button type="submit" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white">
            Add entry
          </button>
        </form>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs text-ink-faint">
              <tr>
                <th className="py-1">Partner</th>
                <th>Signups</th>
                <th>Converted</th>
                <th>Revenue</th>
                <th>Owed</th>
                <th>Paid</th>
                <th>Outstanding</th>
                <th>Statement</th>
              </tr>
            </thead>
            <tbody>
              {data.partners.map((p) => (
                <tr key={p.slug} className="border-t border-edge">
                  <td className="py-1.5">
                    {p.name} (/{p.slug})
                  </td>
                  <td>{p.signups}</td>
                  <td>{p.converted}</td>
                  <td>{gbpFromPennies(p.revenueAttributedPennies)}</td>
                  <td>{gbpFromPennies(p.commissionOwedPennies)}</td>
                  <td>{gbpFromPennies(p.commissionPaidPennies)}</td>
                  <td>{gbpFromPennies(p.outstandingPennies)}</td>
                  <td>
                    <pre className="max-w-[180px] overflow-x-auto text-[10px] text-ink-faint">
                      {partnerStatementCsv(p, quarter)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
