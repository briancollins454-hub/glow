import { PLATFORM_TZ } from "@/lib/locale";
import Link from "next/link";
import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { OwnerOmniSearch } from "@/components/owner/owner-omni-search";
import { getDeliverabilitySnapshot } from "@/lib/owner/deliverability";
import { formatMetric, metricReason } from "@/components/owner/metric-tile";
import { unsuppressEmailAction, clearTechDeliveryFlagAction } from "../deliverability-actions";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DeliverabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const data = await getDeliverabilitySnapshot();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Deliverability</h1>
          <p className="text-sm text-ink-soft">
            Email health by window, kind and recipient domain. Unsuppress requires a reason.
          </p>
        </div>
        <OwnerOmniSearch />
      </div>
      <OwnerNav />

      {sp.ok ? (
        <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">Saved ({sp.ok}).</p>
      ) : null}
      {sp.err === "confirm" ? (
        <p className="rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-warning-text">Type yes to confirm.</p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        {(["24h", "7d", "30d"] as const).map((w) => {
          const s = data.windows[w];
          return (
            <div key={w} className="rounded-xl border border-edge bg-surface p-4 text-sm">
              <p className="font-medium">Last {w}</p>
              <ul className="mt-2 space-y-1 text-ink-soft">
                <li>Sent: {formatMetric(s.sent)}</li>
                <li>Delivered: {formatMetric(s.delivered)}</li>
                <li>Bounced: {formatMetric(s.bounced)}</li>
                <li>Complained: {formatMetric(s.complained)}</li>
                <li>Deferred: {formatMetric(s.deferred)}</li>
                <li title={metricReason(s.skipped) ?? undefined}>Failed: {formatMetric(s.skipped)}</li>
              </ul>
            </div>
          );
        })}
      </div>

      <section className="rounded-xl border border-edge bg-surface p-4">
        <h2 className="font-display text-lg font-semibold">By message kind (30d)</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-ink-faint">
              <tr>
                <th className="py-1">Kind</th>
                <th>Sent</th>
                <th>Delivered</th>
                <th>Bounced</th>
                <th>Complained</th>
              </tr>
            </thead>
            <tbody>
              {data.byKind.map((r) => (
                <tr key={r.kind} className="border-t border-edge">
                  <td className="py-1.5 font-medium">{r.kind}</td>
                  <td>{r.sent}</td>
                  <td>{r.delivered}</td>
                  <td>{r.bounced}</td>
                  <td>{r.complained}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-edge bg-surface p-4">
        <h2 className="font-display text-lg font-semibold">By recipient domain (30d)</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {data.byDomain.map((d) => (
            <li key={d.domain}>
              <strong>{d.domain}</strong> — sent {d.sent}, bounced {d.bounced}, complained {d.complained}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-edge bg-surface p-4">
        <h2 className="font-display text-lg font-semibold">Suppression list</h2>
        <div className="mt-3 space-y-3">
          {data.suppressions.length === 0 ? (
            <p className="text-sm text-ink-faint">No suppressions.</p>
          ) : (
            data.suppressions.map((s) => (
              <div key={s.email} className="rounded-lg border border-edge px-3 py-2 text-sm">
                <p className="font-medium">{s.email}</p>
                <p className="text-xs text-ink-soft">
                  {s.reason ?? "—"} · {s.permanent ? "hard" : "soft"} · failures {s.consecutiveSoftFailures} ·{" "}
                  {s.lastEventType ?? "—"} · {fmtDateTime(s.updatedAt, PLATFORM_TZ)}
                </p>
                <p className="text-xs text-ink-faint">
                  Accounts: {s.accounts.length ? s.accounts.join(", ") : "—"}
                </p>
                <form action={unsuppressEmailAction} className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="email" value={s.email} />
                  <div>
                    <label className="block text-xs text-ink-faint">Reason</label>
                    <input
                      name="reason"
                      required
                      className="mt-1 w-56 rounded-lg border border-edge bg-cream px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-ink-faint">Type yes</label>
                    <input
                      name="confirm"
                      className="mt-1 w-20 rounded-lg border border-edge bg-cream px-2 py-1 text-sm"
                    />
                  </div>
                  <button type="submit" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white">
                    Unsuppress
                  </button>
                </form>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-edge bg-surface p-4">
        <h2 className="font-display text-lg font-semibold">Accounts with delivery flags</h2>
        <div className="mt-2 space-y-2 text-sm">
          {data.flaggedAccounts.length === 0 ? (
            <p className="text-ink-faint">None flagged.</p>
          ) : (
            data.flaggedAccounts.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge px-3 py-2">
                <div>
                  <Link href={`/dashboard/admin/accounts/${t.id}`} className="font-medium hover:underline">
                    {t.businessName || t.handle}
                  </Link>
                  <p className="text-xs text-ink-faint">
                    {t.email} · {t.reason ?? "—"} · {t.at ? fmtDateTime(t.at, PLATFORM_TZ) : "—"}
                  </p>
                </div>
                <form action={clearTechDeliveryFlagAction} className="flex items-end gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <input
                    name="confirm"
                    placeholder="yes"
                    className="w-16 rounded-lg border border-edge bg-cream px-2 py-1 text-sm"
                  />
                  <button type="submit" className="rounded-lg border border-edge px-2 py-1 text-xs">
                    Clear flag
                  </button>
                </form>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
