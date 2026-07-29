import Link from "next/link";
import { anyKillSwitchActive, KILL_SWITCH_LABELS } from "@/lib/owner/controls";

/** Persistent banner across owner console while any kill switch is on. */
export async function KillSwitchBanner() {
  const active = await anyKillSwitchActive().catch(() => []);
  if (!active.length) return null;
  return (
    <div className="border-b-2 border-red-600 bg-red-600 text-white">
      <div className="container-page flex flex-wrap items-center justify-between gap-2 py-2 text-sm font-semibold">
        <span>
          Kill switch active:{" "}
          {active.map((s) => KILL_SWITCH_LABELS[s.key]).join(" · ")}
          {active[0]?.pausedBy ? ` — set by ${active[0].pausedBy}` : ""}
        </span>
        <Link href="/dashboard/admin/controls" className="underline underline-offset-2">
          Manage controls
        </Link>
      </div>
    </div>
  );
}
