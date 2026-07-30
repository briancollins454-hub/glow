import { PLATFORM_TZ } from "@/lib/locale";
import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { getKillSwitches, KILL_SWITCH_LABELS, type KillSwitchKey } from "@/lib/owner/controls";
import { setKillSwitchAction } from "../phase3-actions";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ControlsPage() {
  await requireOwner();
  const switches = await getKillSwitches();
  const keys = Object.keys(KILL_SWITCH_LABELS) as KillSwitchKey[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Kill switches</h1>
        <p className="text-sm text-ink-soft">
          Instant, global, no-deploy. Enforced at the send/execute layer. Confirmation + reason required.
        </p>
      </div>
      <OwnerNav />

      <div className="space-y-4">
        {keys.map((key) => {
          const s = switches[key];
          return (
            <section key={key} className="rounded-xl border border-edge bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-semibold">{KILL_SWITCH_LABELS[key]}</h2>
                  <p className="text-sm text-ink-soft">
                    {s.paused ? (
                      <>
                        <Badge tone="amber">ON</Badge> by {s.pausedBy || "—"} at{" "}
                        {s.pausedAt ? fmtDateTime(s.pausedAt, PLATFORM_TZ) : "—"}
                        {s.pausedReason ? ` — ${s.pausedReason}` : ""}
                      </>
                    ) : (
                      <Badge tone="green">Off</Badge>
                    )}
                  </p>
                </div>
                <form action={setKillSwitchAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="key" value={key} />
                  <input type="hidden" name="paused" value={s.paused ? "0" : "1"} />
                  <input
                    name="reason"
                    required
                    placeholder="Reason"
                    className="w-48 rounded-lg border border-edge px-2 py-1.5 text-sm"
                  />
                  <input
                    name="confirm"
                    placeholder="yes"
                    className="w-16 rounded-lg border border-edge px-2 py-1.5 text-sm"
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    className={
                      s.paused
                        ? "rounded-lg border border-edge px-3 py-1.5 text-sm"
                        : "rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white"
                    }
                  >
                    {s.paused ? "Turn off" : "Pause now"}
                  </button>
                </form>
              </div>
            </section>
          );
        })}
      </div>
      <p className="text-xs text-ink-faint">
        Per-account outbound pause is on each account detail page. A red banner shows across the owner
        console while any switch is active.
      </p>
    </div>
  );
}
