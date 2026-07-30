import { PLATFORM_TZ } from "@/lib/locale";
import Link from "next/link";
import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { getFeedbackBoard } from "@/lib/owner/feedback-board";
import { setFeedbackStatusAction } from "../phase2-actions";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const TONE: Record<string, "neutral" | "amber" | "green" | "red"> = {
  open: "amber",
  planned: "neutral",
  shipped: "green",
  declined: "red",
};

export default async function FeedbackBoardPage() {
  await requireOwner();
  const data = await getFeedbackBoard();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Feedback roadmap</h1>
        <p className="text-sm text-ink-soft">
          Aggregated requests. Requester count is the strongest prioritisation signal.
        </p>
      </div>
      <OwnerNav />

      <div className="space-y-3">
        {data.themes.length === 0 ? (
          <p className="text-sm text-ink-faint">No feedback yet.</p>
        ) : (
          data.themes.map((t) => (
            <section key={t.themeKey} className="rounded-xl border border-edge bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-semibold">{t.title}</h2>
                  <p className="text-sm text-ink-soft">{t.sampleMessage}</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {t.requesterCount} account{t.requesterCount === 1 ? "" : "s"} · updated{" "}
                    {fmtDate(t.updatedAt, PLATFORM_TZ)}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1 text-xs">
                    {t.requesters.slice(0, 8).map((r) => (
                      <Link
                        key={r.techId}
                        href={`/dashboard/admin/accounts/${r.techId}`}
                        className="text-brand-text hover:underline"
                      >
                        /{r.handle}
                      </Link>
                    ))}
                  </p>
                </div>
                <Badge tone={TONE[t.status] ?? "neutral"}>{t.status}</Badge>
              </div>
              <form action={setFeedbackStatusAction} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="themeKey" value={t.themeKey} />
                <input type="hidden" name="ids" value={t.ids.join(",")} />
                <select name="status" defaultValue={t.status} className="rounded-lg border border-edge px-2 py-1.5 text-sm">
                  <option value="open">Open</option>
                  <option value="planned">Planned</option>
                  <option value="shipped">Shipped</option>
                  <option value="declined">Declined</option>
                </select>
                <label className="flex items-center gap-1 text-xs text-ink-soft">
                  <input type="checkbox" name="notify" value="1" /> Notify requesters on ship
                </label>
                <input
                  name="confirm"
                  placeholder="yes"
                  className="w-16 rounded-lg border border-edge px-2 py-1.5 text-sm"
                  autoComplete="off"
                />
                <button type="submit" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white">
                  Update
                </button>
              </form>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
