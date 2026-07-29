import Link from "next/link";
import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { getEconomicsSnapshot, currentPeriodMonth } from "@/lib/owner/economics";
import { gbpFromPennies } from "@/lib/owner/mrr";
import { addCostRecordAction } from "../phase2-actions";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function EconomicsPage() {
  await requireOwner();
  const data = await getEconomicsSnapshot();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Unit economics</h1>
        <p className="text-sm text-ink-soft">{data.note}</p>
      </div>
      <OwnerNav />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Period" value={data.periodMonth} />
        <Tile label="Platform costs" value={gbpFromPennies(data.platformCostPennies)} />
        <Tile label="Paying accounts" value={String(data.payingAccounts)} />
        <Tile label="Allocable / account" value={gbpFromPennies(data.allocablePerAccountPennies)} />
      </div>

      <section className="rounded-xl border border-edge bg-surface p-4">
        <h2 className="font-display text-lg font-semibold">Enter monthly cost</h2>
        <form action={addCostRecordAction} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="periodMonth" value={currentPeriodMonth()} />
          <select name="provider" className="rounded-lg border border-edge px-2 py-1.5 text-sm">
            <option value="supabase">Supabase</option>
            <option value="resend">Resend</option>
            <option value="twilio">Twilio</option>
            <option value="vercel">Vercel</option>
            <option value="stripe">Stripe fees</option>
          </select>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="£ amount"
            className="w-28 rounded-lg border border-edge px-2 py-1.5 text-sm"
          />
          <input
            name="notes"
            placeholder="Notes"
            className="min-w-[160px] flex-1 rounded-lg border border-edge px-2 py-1.5 text-sm"
          />
          <input
            name="confirm"
            placeholder="yes"
            className="w-16 rounded-lg border border-edge px-2 py-1.5 text-sm"
            autoComplete="off"
          />
          <button type="submit" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white">
            Save
          </button>
        </form>
        <ul className="mt-3 space-y-1 text-sm">
          {data.costs.map((c) => (
            <li key={c.id}>
              {c.provider} · {gbpFromPennies(c.amountPennies)} · {c.notes || "—"}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-edge bg-surface p-4">
        <h2 className="font-display text-lg font-semibold">
          Per-account margin (warn ≥ {data.warnPercent}% attributable)
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs text-ink-faint">
              <tr>
                <th className="py-1">Account</th>
                <th>Revenue</th>
                <th>Allocable</th>
                <th>Attributable</th>
                <th>Margin</th>
                <th>SMS</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.accounts.slice(0, 80).map((a) => (
                <tr key={a.techId} className="border-t border-edge">
                  <td className="py-1.5">
                    <Link href={`/dashboard/admin/accounts/${a.techId}`} className="hover:underline">
                      {a.label}
                    </Link>
                  </td>
                  <td>{gbpFromPennies(a.revenuePennies)}</td>
                  <td>{gbpFromPennies(a.allocableSharePennies)}</td>
                  <td>{gbpFromPennies(a.attributablePennies)}</td>
                  <td>{gbpFromPennies(a.marginPennies)}</td>
                  <td>{gbpFromPennies(a.smsCostPennies)}</td>
                  <td>{a.flagged ? <Badge tone="amber">high cost</Badge> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-edge bg-surface p-4">
        <h2 className="font-display text-lg font-semibold">Top SMS consumers</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {data.topSms.length === 0 ? (
            <li className="text-ink-faint">No sms_usage rows for this month yet (daily job rolls up).</li>
          ) : (
            data.topSms.map((s) => (
              <li key={s.techId}>
                <Link href={`/dashboard/admin/accounts/${s.techId}`} className="hover:underline">
                  {s.label}
                </Link>{" "}
                · {s.messageCount} msgs · {gbpFromPennies(s.costPennies)}
              </li>
            ))
          )}
        </ul>
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
