import { requireOwner } from "@/lib/owner/require-owner";
import { listCronRuns, listOutboundSends, listPlatformErrors, runIntegrityChecks } from "@/lib/owner/ops";
import { OwnerNav } from "@/components/owner/owner-nav";
import { MetricTile } from "@/components/owner/metric-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDateTime } from "@/lib/format";
import { ownerRunCronAction } from "../owner-actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OwnerOpsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string; integrity?: string }>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const [crons, errors, sends] = await Promise.all([
    listCronRuns(30),
    listPlatformErrors(40),
    listOutboundSends(40),
  ]);
  const integrity = sp.integrity === "1" ? await runIntegrityChecks() : null;
  const last = crons[0] ?? null;
  const failed24 = crons.filter(
    (c) => !c.ok && new Date(c.startedAt).getTime() > Date.now() - 86400000,
  ).length;
  const sendFail24 = sends.filter(
    (s) => !s.ok && new Date(String(s.createdAt)).getTime() > Date.now() - 86400000,
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Operations and monitoring</h1>
        <p className="text-sm text-ink-soft">Cron, outbound sends, errors, and on-demand integrity checks.</p>
      </div>
      <OwnerNav />

      {sp.ok === "cron" ? (
        <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">Cron run finished.</p>
      ) : null}
      {sp.err === "confirm" ? (
        <p className="rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-warning-text">
          Type <strong>yes</strong> to confirm Run now.
        </p>
      ) : null}
      {sp.err === "cron" ? (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-text">Cron run failed. See log below.</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Last cron"
          value={last ? (last.ok ? "OK" : "Failed") : "None"}
          hint={last ? `${last.job} · ${last.startedAt}` : "After migration 0044"}
        />
        <MetricTile label="Failed crons (24h)" value={String(failed24)} tone="red" />
        <MetricTile label="Send failures (sample)" value={String(sendFail24)} tone="amber" />
        <MetricTile label="Recent errors listed" value={String(errors.length)} tone="red" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cron: reminders job</CardTitle>
          <CardDescription>Schedule: every 15 minutes (vercel.json). Manual run is audited.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={ownerRunCronAction} className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs text-ink-faint">Type yes to confirm</label>
              <input name="confirm" className="mt-1 w-28 rounded-lg border border-edge px-2 py-1.5 text-sm" />
            </div>
            <button type="submit" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white">
              Run now
            </button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-ink-faint">
                <tr>
                  <th className="px-2 py-1">When</th>
                  <th className="px-2 py-1">Trigger</th>
                  <th className="px-2 py-1">OK</th>
                  <th className="px-2 py-1">Duration</th>
                  <th className="px-2 py-1">Result</th>
                </tr>
              </thead>
              <tbody>
                {crons.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-3 text-ink-faint">
                      No cron_runs yet. Apply migration 0044, then wait for the next schedule or Run now.
                    </td>
                  </tr>
                ) : (
                  crons.map((c) => (
                    <tr key={c.id} className="border-t border-edge align-top">
                      <td className="px-2 py-1.5">{fmtDateTime(c.startedAt)}</td>
                      <td className="px-2 py-1.5">{c.trigger}</td>
                      <td className="px-2 py-1.5">
                        <Badge tone={c.ok ? "green" : "red"}>{c.ok ? "ok" : "fail"}</Badge>
                      </td>
                      <td className="px-2 py-1.5">{c.durationMs != null ? `${c.durationMs}ms` : "—"}</td>
                      <td className="px-2 py-1.5 font-mono text-xs text-ink-soft">
                        {c.error ?? JSON.stringify(c.result)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Outbound email log</CardTitle>
            <CardDescription>Recent Resend attempts (after migration 0044)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm max-h-96 overflow-y-auto">
            {sends.length === 0 ? (
              <p className="text-ink-faint">None logged yet.</p>
            ) : (
              sends.map((s: Record<string, unknown>) => (
                <div key={String(s.id)} className="rounded-lg border border-edge px-3 py-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{String(s.subject ?? s.kind ?? "send")}</span>
                    <Badge tone={s.ok ? "green" : "red"}>{s.ok ? "ok" : "fail"}</Badge>
                  </div>
                  <p className="text-xs text-ink-faint">
                    {String(s.destination ?? "")} · {fmtDateTime(String(s.createdAt))}
                    {s.error ? ` · ${String(s.error)}` : ""}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Error log</CardTitle>
            <CardDescription>From reportError (persisted after migration 0044)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm max-h-96 overflow-y-auto">
            {errors.length === 0 ? (
              <p className="text-ink-faint">None logged yet.</p>
            ) : (
              errors.map((e: Record<string, unknown>) => (
                <div key={String(e.id)} className="rounded-lg border border-edge px-3 py-2">
                  <p className="font-medium">{String(e.signature)}</p>
                  <p className="text-xs text-ink-faint">
                    {String(e.where ?? "")} · {fmtDateTime(String(e.createdAt))}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data integrity</CardTitle>
          <CardDescription>On-demand checks. Fix actions stay guarded (name cleanup tool).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Link
            href="/dashboard/admin/ops?integrity=1"
            className="inline-flex rounded-xl border border-edge px-3 py-2 text-sm font-medium hover:border-brand-400/40"
          >
            Run integrity checks
          </Link>
          {integrity ? (
            <div className="space-y-3">
              {integrity.map((f) => (
                <div key={f.check} className="rounded-xl border border-edge p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{f.check}</p>
                    <Badge tone={f.count ? "amber" : "green"}>{f.count}</Badge>
                    {f.fixable ? (
                      <Link href="/dashboard/admin/client-name-cleanup" className="text-brand-text hover:underline">
                        Open cleanup
                      </Link>
                    ) : null}
                  </div>
                  <p className="mt-1 text-ink-faint">{f.note}</p>
                  {f.sample.length > 0 ? (
                    <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-fill p-2 text-xs">
                      {JSON.stringify(f.sample.slice(0, 5), null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
