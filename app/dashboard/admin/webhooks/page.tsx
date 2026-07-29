import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import {
  getIntegrationHealth,
  listResendWebhookEvents,
  listStripeWebhookEvents,
} from "@/lib/owner/webhooks";
import { replayWebhookAction } from "../phase3-actions";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OwnerWebhooksPage({
  searchParams,
}: {
  searchParams: Promise<{ failures?: string; ok?: string; err?: string }>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const failuresOnly = sp.failures === "1";
  const [stripeEvents, resendEvents, health] = await Promise.all([
    listStripeWebhookEvents({ failuresOnly, limit: 60 }),
    listResendWebhookEvents(40),
    getIntegrationHealth(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Webhooks & integrations</h1>
        <p className="text-sm text-ink-soft">
          Inbound Stripe/Resend events, replay for debugging, and outbound provider health.
        </p>
      </div>
      <OwnerNav />

      {sp.ok === "replay" ? (
        <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">Replay claimed.</p>
      ) : null}
      {sp.err ? (
        <p className="rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-warning-text">
          Replay needs confirmation, or failed to reclaim.
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        {health.map((h) => (
          <div key={h.provider} className="rounded-xl border border-edge bg-surface p-4 text-sm">
            <h2 className="font-display text-base font-semibold capitalize">{h.provider}</h2>
            <p className="text-ink-soft">
              Last OK: {h.lastSuccessAt ? fmtDateTime(h.lastSuccessAt) : "—"}
            </p>
            <p className="text-ink-soft">
              24h: {h.successCount24h} ok / {h.errorCount24h} err
            </p>
          </div>
        ))}
      </section>

      <div className="flex gap-2 text-sm">
        <a
          href="/dashboard/admin/webhooks"
          className={!failuresOnly ? "font-semibold text-brand-text" : "text-ink-soft"}
        >
          All Stripe
        </a>
        <span className="text-ink-faint">·</span>
        <a
          href="/dashboard/admin/webhooks?failures=1"
          className={failuresOnly ? "font-semibold text-brand-text" : "text-ink-soft"}
        >
          Failures only
        </a>
      </div>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Stripe webhook events</h2>
        {stripeEvents.length === 0 ? (
          <p className="text-sm text-ink-soft">None logged yet.</p>
        ) : (
          stripeEvents.map((e) => (
            <div
              key={e.eventId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-edge bg-surface px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">{e.type}</span>
                <span className="text-ink-faint">
                  {" "}
                  · {fmtDateTime(e.processedAt)}
                  {e.error ? ` · ${e.error}` : ""}
                  {e.replayCount ? ` · replay×${e.replayCount}` : ""}
                </span>
                <div className="font-mono text-xs text-ink-faint">{e.eventId}</div>
              </div>
              <form action={replayWebhookAction} className="flex items-end gap-2">
                <input type="hidden" name="eventId" value={e.eventId} />
                <input
                  name="confirm"
                  placeholder="yes"
                  className="w-14 rounded-lg border border-edge px-2 py-1 text-sm"
                  autoComplete="off"
                />
                <button type="submit" className="rounded-lg border border-edge px-2 py-1 text-sm">
                  Replay
                </button>
              </form>
            </div>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Resend webhook events</h2>
        {resendEvents.length === 0 ? (
          <p className="text-sm text-ink-soft">None logged yet (needs migration 0060).</p>
        ) : (
          resendEvents.map((e) => (
            <div
              key={e.id}
              className="rounded-xl border border-edge bg-surface px-3 py-2 text-sm"
            >
              <Badge tone={e.ok ? "green" : "amber"}>{e.ok ? "ok" : "fail"}</Badge>{" "}
              <span className="font-medium">{e.type}</span>
              <span className="text-ink-faint">
                {" "}
                · {fmtDateTime(e.receivedAt)}
                {e.emailId ? ` · ${e.emailId}` : ""}
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
