import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { previewBroadcastAction, sendBroadcastAction } from "../phase4-actions";
import { supabaseService } from "@/lib/supabase/service";
import { renderBroadcastPreview } from "@/lib/owner/broadcast";
import { anyKillSwitchActive } from "@/lib/owner/controls";

export const dynamic = "force-dynamic";

export default async function OwnerBroadcastPage({
  searchParams,
}: {
  searchParams: Promise<{
    preview?: string;
    count?: string;
    ok?: string;
    err?: string;
    n?: string;
  }>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const active = await anyKillSwitchActive().catch(() => []);
  let previewRow = null as {
    id: string;
    subject: string;
    body: string;
    recipientCount: number;
    filter: unknown;
  } | null;
  if (sp.preview) {
    const { data } = await supabaseService()
      .from("owner_broadcasts")
      .select("*")
      .eq("id", sp.preview)
      .maybeSingle();
    previewRow = data;
  }
  const sample = previewRow
    ? renderBroadcastPreview({
        subject: previewRow.subject,
        body: previewRow.body,
        sampleName: "Alex",
      })
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Broadcast</h1>
        <p className="text-sm text-ink-soft">
          Compose to a filtered set. Preview is mandatory. Respects kill switches. Excludes internal
          unless opted in. Fully logged.
        </p>
      </div>
      <OwnerNav />

      {active.length ? (
        <p className="rounded-xl bg-red-600/15 px-4 py-3 text-sm text-danger-text">
          Kill switch active — send will be blocked at the email layer until cleared.
        </p>
      ) : null}
      {sp.ok === "sent" ? (
        <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">
          Broadcast sent to {sp.n ?? "?"} accounts.
        </p>
      ) : null}
      {sp.err ? (
        <p className="rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-warning-text">
          {sp.err === "confirm"
            ? "Type yes to confirm send."
            : sp.err === "fields"
              ? "Subject and body required."
              : `Could not send: ${sp.err}`}
        </p>
      ) : null}

      <form action={previewBroadcastAction} className="space-y-3 rounded-xl border border-edge bg-surface p-4">
        <div>
          <label className="text-xs text-ink-faint">Audience</label>
          <select name="filter" className="mt-1 w-full rounded-lg border border-edge px-3 py-2 text-sm">
            <option value="paying">All paying</option>
            <option value="trialing">All trialing</option>
            <option value="at_risk">At risk</option>
            <option value="all_live">All live (active/trial/comped)</option>
            <option value="tag">By tag</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-ink-faint">Tag (when audience = by tag)</label>
          <input name="tag" className="mt-1 w-full rounded-lg border border-edge px-3 py-2 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="includeInternal" value="1" />
          Include internal accounts
        </label>
        <div>
          <label className="text-xs text-ink-faint">Subject (use {"{{name}}"})</label>
          <input
            name="subject"
            required
            className="mt-1 w-full rounded-lg border border-edge px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-ink-faint">Body (use {"{{name}}"})</label>
          <textarea
            name="body"
            required
            rows={8}
            className="mt-1 w-full rounded-lg border border-edge px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">
          Preview recipients
        </button>
      </form>

      {previewRow && sample ? (
        <section className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <h2 className="font-display text-lg font-semibold">
            Preview — {previewRow.recipientCount} recipients
          </h2>
          <p className="text-sm">
            <strong>Subject:</strong> {sample.subject}
          </p>
          <pre className="whitespace-pre-wrap rounded-lg bg-surface p-3 text-sm">{sample.text}</pre>
          <form action={sendBroadcastAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="broadcastId" value={previewRow.id} />
            <div>
              <label className="block text-xs text-ink-faint">Type yes to send</label>
              <input
                name="confirm"
                className="mt-1 w-28 rounded-lg border border-edge px-2 py-1.5 text-sm"
                autoComplete="off"
              />
            </div>
            <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white">
              Send to {previewRow.recipientCount}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
