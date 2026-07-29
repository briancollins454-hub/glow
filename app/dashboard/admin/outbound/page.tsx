import Link from "next/link";
import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { listUpcomingOutbound, groupByKind } from "@/lib/owner/outbound";
import { cancelOutboundSendAction, cancelAllOutboundAction } from "../phase3-actions";
import { fmtDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function OutboundPage({
  searchParams,
}: {
  searchParams: Promise<{ tech?: string; hours?: string; ok?: string; err?: string }>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const hours = Number(sp.hours ?? "168") || 168;
  const techId = sp.tech || undefined;
  const sends = await listUpcomingOutbound({ techId, withinHours: hours, limit: 200 });
  const byKind = groupByKind(sends.filter((s) => {
    const h = (new Date(s.scheduledFor).getTime() - Date.now()) / 3600_000;
    return h <= 24;
  }));
  const platform24 = await listUpcomingOutbound({ withinHours: 24, limit: 500 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Outbound preview</h1>
        <p className="text-sm text-ink-soft">
          What Glow will send on accounts&apos; behalf. Cancel before it fires — with a reason, logged.
        </p>
      </div>
      <OwnerNav />

      {sp.ok ? (
        <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">Saved ({sp.ok}).</p>
      ) : null}
      {sp.err ? (
        <p className="rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-warning-text">
          Action needs confirmation and a reason.
        </p>
      ) : null}

      <section className="rounded-xl border border-edge bg-surface p-4">
        <h2 className="font-display text-lg font-semibold">Next 24 hours (platform)</h2>
        <p className="text-sm text-ink-soft">{platform24.length} client-facing sends due</p>
        <ul className="mt-2 flex flex-wrap gap-2 text-sm">
          {byKind.map((k) => (
            <li key={k.kind}>
              <Badge tone="neutral">
                {k.kind}: {k.count}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      <form className="flex flex-wrap gap-2">
        <input
          name="tech"
          defaultValue={techId ?? ""}
          placeholder="Filter tech id (optional)"
          className="min-w-[220px] flex-1 rounded-xl border border-edge px-3 py-2 text-sm"
        />
        <select name="hours" defaultValue={String(hours)} className="rounded-xl border border-edge px-3 py-2 text-sm">
          <option value="24">24 hours</option>
          <option value="168">7 days</option>
        </select>
        <button type="submit" className="rounded-xl bg-brand-600 px-4 py-2 text-sm text-white">
          Filter
        </button>
      </form>

      {techId ? (
        <form action={cancelAllOutboundAction} className="flex flex-wrap items-end gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <input type="hidden" name="techId" value={techId} />
          <p className="w-full text-sm">Cancel all upcoming for this account</p>
          <input name="reason" placeholder="Reason" className="min-w-[200px] flex-1 rounded-lg border border-edge px-2 py-1.5 text-sm" />
          <input name="confirm" placeholder="yes" className="w-16 rounded-lg border border-edge px-2 py-1.5 text-sm" />
          <button type="submit" className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm text-white">
            Cancel all
          </button>
        </form>
      ) : null}

      <div className="space-y-3">
        {sends.length === 0 ? (
          <p className="text-sm text-ink-faint">No scheduled client-facing sends in this window.</p>
        ) : (
          sends.map((s) => (
            <section key={s.id} className="rounded-xl border border-edge bg-surface p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {s.subject} · {s.kind} · {s.channel}
                  </p>
                  <p className="text-ink-soft">
                    <Link href={`/dashboard/admin/accounts/${s.techId}`} className="hover:underline">
                      {s.techLabel}
                    </Link>{" "}
                    → {s.destination || "(no destination yet)"}
                  </p>
                  <p className="text-xs text-ink-faint">
                    {fmtDateTime(s.scheduledFor)} · {s.triggerLabel}
                    {s.marketing ? " · marketing" : " · transactional"}
                  </p>
                </div>
                <form action={cancelOutboundSendAction} className="flex flex-wrap items-end gap-1">
                  <input type="hidden" name="reminderId" value={s.sourceId} />
                  <input name="reason" placeholder="Reason" className="w-36 rounded border border-edge px-1 text-xs" />
                  <input name="confirm" placeholder="yes" className="w-12 rounded border border-edge px-1 text-xs" />
                  <button type="submit" className="rounded bg-amber-700 px-2 py-1 text-xs text-white">
                    Cancel
                  </button>
                </form>
              </div>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-cream p-2 text-xs">
                {s.bodyPreview || "(empty preview)"}
              </pre>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
