import Link from "next/link";
import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { buildWorklists, type WorklistKey } from "@/lib/owner/worklists";
import { worklistNudgeAction } from "../phase2-actions";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const LABELS: Record<WorklistKey, string> = {
  stalled_signups: "Stalled signups",
  setup_not_live: "Set up, not live",
  live_no_bookings: "Live, no bookings",
  trial_cohort: "Trial cohort",
  at_risk: "At risk",
  churn_watch: "Churn watch",
  past_due: "Past due / dunning",
  awaiting_migration: "Awaiting migration",
};

const NUDGE: Partial<Record<WorklistKey, string>> = {
  stalled_signups: "setup_help",
  setup_not_live: "go_live",
  live_no_bookings: "setup_help",
  trial_cohort: "trial_nudge",
  churn_watch: "win_back",
  past_due: "win_back",
};

export default async function WorklistsPage() {
  await requireOwner();
  const data = await buildWorklists();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Worklists</h1>
        <p className="text-sm text-ink-soft">
          Actionable queues. Each row shows the blocking step, days in state, and prior nudges.
        </p>
      </div>
      <OwnerNav />

      {(Object.keys(LABELS) as WorklistKey[]).map((key) => {
        const rows = data.lists[key];
        return (
          <section key={key} className="rounded-xl border border-edge bg-surface p-4">
            <h2 className="font-display text-lg font-semibold">
              {LABELS[key]}{" "}
              <span className="text-sm font-normal text-ink-faint">({rows.length})</span>
            </h2>
            {rows.length === 0 ? (
              <p className="mt-2 text-sm text-ink-faint">Clear.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {rows.slice(0, 40).map((r) => (
                  <li
                    key={`${key}-${r.techId}`}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-edge px-3 py-2 text-sm"
                  >
                    <div>
                      <Link href={r.href} className="font-medium hover:underline">
                        {r.label}
                      </Link>
                      <p className="text-ink-soft">{r.blockingStep}</p>
                      <p className="text-xs text-ink-faint">
                        {r.daysInState}d in state
                        {r.lastContact ? ` · last contact ${r.lastContact}` : ""}
                        {r.tried.length ? ` · tried: ${r.tried[0]}` : ""}
                      </p>
                      {r.meta?.dayN != null ? (
                        <p className="text-xs text-ink-faint">
                          Card on file: {r.meta.cardOnFile ? "yes" : "no"} · predicted conversion{" "}
                          {r.meta.predictedConversionPct}% · charge {String(r.meta.projectedChargeDate ?? "—")}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/dashboard/admin/support-import?tech=${encodeURIComponent(r.techId)}`}
                        className="rounded-lg border border-edge px-2 py-1 text-xs"
                      >
                        Assisted setup
                      </Link>
                      {NUDGE[key] ? (
                        <form action={worklistNudgeAction} className="flex items-center gap-1">
                          <input type="hidden" name="id" value={r.techId} />
                          <input type="hidden" name="kind" value={NUDGE[key]} />
                          <input
                            name="confirm"
                            placeholder="type yes"
                            className="w-12 rounded border border-edge px-1 text-xs"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            autoComplete="off"
                            />
                          <button type="submit" className="rounded-lg bg-brand-600 px-2 py-1 text-xs text-white">
                            Nudge
                          </button>
                        </form>
                      ) : null}
                      {key === "at_risk" ? <Badge tone="amber">at risk</Badge> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
