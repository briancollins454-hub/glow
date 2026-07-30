import { PLATFORM_TZ } from "@/lib/locale";
import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { listFeatureFlags } from "@/lib/owner/flags";
import { setFlagGlobalAction, setFlagOverrideAction } from "../phase3-actions";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OwnerFlagsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const flags = await listFeatureFlags();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Feature flags</h1>
        <p className="text-sm text-ink-soft">
          Global gates and per-account overrides. Visible on account detail once set.
        </p>
      </div>
      <OwnerNav />

      {sp.ok ? (
        <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">Saved ({sp.ok}).</p>
      ) : null}
      {sp.err === "confirm" ? (
        <p className="rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-warning-text">
          Type <strong>yes</strong> to confirm.
        </p>
      ) : null}

      {flags.length === 0 ? (
        <p className="text-sm text-ink-soft">No flags yet (run migration 0060).</p>
      ) : (
        <div className="space-y-4">
          {flags.map((f) => (
            <section key={f.key} className="rounded-xl border border-edge bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold font-mono">{f.key}</h2>
                  <p className="text-sm text-ink-soft">{f.description}</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {f.enabledGlobal ? <Badge tone="green">global on</Badge> : <Badge tone="neutral">global off</Badge>}
                    {f.updatedByEmail
                      ? ` · ${f.updatedByEmail} · ${fmtDateTime(f.updatedAt, PLATFORM_TZ)}`
                      : null}
                  </p>
                </div>
                <form action={setFlagGlobalAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="key" value={f.key} />
                  <input type="hidden" name="enabled" value={f.enabledGlobal ? "0" : "1"} />
                  <input
                    name="confirm"
                    placeholder="yes"
                    className="w-14 rounded-lg border border-edge px-2 py-1.5 text-sm"
                    autoComplete="off"
                  />
                  <button type="submit" className="rounded-lg border border-edge px-3 py-1.5 text-sm">
                    {f.enabledGlobal ? "Turn off globally" : "Turn on globally"}
                  </button>
                </form>
              </div>
              <form
                action={setFlagOverrideAction}
                className="mt-3 flex flex-wrap items-end gap-2 border-t border-edge pt-3"
              >
                <input type="hidden" name="key" value={f.key} />
                <input
                  name="techId"
                  required
                  placeholder="Tech id for override"
                  className="min-w-[200px] flex-1 rounded-lg border border-edge px-2 py-1.5 font-mono text-xs"
                />
                <select name="enabled" className="rounded-lg border border-edge px-2 py-1.5 text-sm">
                  <option value="1">Force on</option>
                  <option value="0">Force off</option>
                </select>
                <input
                  name="confirm"
                  placeholder="yes"
                  className="w-14 rounded-lg border border-edge px-2 py-1.5 text-sm"
                  autoComplete="off"
                />
                <button type="submit" className="rounded-lg border border-edge px-3 py-1.5 text-sm">
                  Set override
                </button>
              </form>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
