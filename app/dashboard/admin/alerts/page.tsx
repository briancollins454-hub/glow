import Link from "next/link";
import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { listOpenAlerts } from "@/lib/owner/alerts";
import { dismissAlertAction } from "../phase3-actions";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OwnerAlertsPage() {
  await requireOwner();
  const alerts = await listOpenAlerts(80);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Anomaly alerts</h1>
        <p className="text-sm text-ink-soft">
          Threshold breaches from the daily job and monitors. Dismiss when reviewed (who/when logged).
        </p>
      </div>
      <OwnerNav />

      {alerts.length === 0 ? (
        <p className="rounded-xl border border-edge bg-surface px-4 py-6 text-sm text-ink-soft">
          No open alerts. Run Owner daily on Operations to evaluate thresholds.
        </p>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => (
            <section key={a.id} className="rounded-xl border border-edge bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={a.severity === "error" ? "amber" : "neutral"}>{a.severity}</Badge>
                    <span className="text-xs text-ink-faint">{a.rule}</span>
                  </div>
                  <h2 className="mt-1 font-display text-lg font-semibold">{a.title}</h2>
                  <p className="text-sm text-ink-soft">{a.body}</p>
                  <p className="mt-2 text-xs text-ink-faint">
                    {fmtDateTime(a.createdAt)}
                    {a.techId ? (
                      <>
                        {" · "}
                        <Link
                          href={`/dashboard/admin/accounts/${a.techId}`}
                          className="text-brand-text hover:underline"
                        >
                          Account
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <form action={dismissAlertAction} className="flex items-end gap-2">
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className="rounded-lg border border-edge px-3 py-1.5 text-sm">
                    Dismiss
                  </button>
                </form>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
