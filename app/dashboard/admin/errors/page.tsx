import { PLATFORM_TZ } from "@/lib/locale";
import Link from "next/link";
import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { listErrorGroups } from "@/lib/owner/error-groups";
import { resolveErrorGroupAction } from "../phase3-actions";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OwnerErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const groups = await listErrorGroups({ limit: 60 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Error groups</h1>
        <p className="text-sm text-ink-soft">
          Recurring platform errors clustered by fingerprint. Mark resolved; they reopen if they recur.
        </p>
      </div>
      <OwnerNav />

      {sp.ok ? (
        <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">Resolved.</p>
      ) : null}
      {sp.err === "confirm" ? (
        <p className="rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-warning-text">
          Type <strong>yes</strong> to confirm.
        </p>
      ) : null}

      {groups.length === 0 ? (
        <p className="rounded-xl border border-edge bg-surface px-4 py-6 text-sm text-ink-soft">
          No open error groups.
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <section key={g.signature} className="rounded-xl border border-edge bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-lg font-semibold">{g.message}</h2>
                  <p className="mt-1 text-sm text-ink-soft">
                    {g.count}× · first {fmtDateTime(g.firstSeen, PLATFORM_TZ)} · last {fmtDateTime(g.lastSeen, PLATFORM_TZ)} ·{" "}
                    {g.affectedAccounts.length} accounts
                  </p>
                  {g.affectedAccounts[0] ? (
                    <p className="mt-1 text-sm">
                      Sample:{" "}
                      <Link
                        href={`/dashboard/admin/accounts/${g.affectedAccounts[0]}`}
                        className="text-brand-text hover:underline"
                      >
                        {g.affectedAccounts[0].slice(0, 10)}…
                      </Link>
                    </p>
                  ) : null}
                  <p className="mt-2 break-all font-mono text-xs text-ink-faint">{g.signature}</p>
                  {g.sampleStack ? (
                    <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-cream p-2 text-xs text-ink-soft">
                      {g.sampleStack.slice(0, 800)}
                    </pre>
                  ) : null}
                </div>
                <form action={resolveErrorGroupAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="signature" value={g.signature} />
                  <input
                    name="confirm"
                    placeholder="type yes"
                    className="w-16 rounded-lg border border-edge px-2 py-1.5 text-sm"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="off"
                    />
                  <button type="submit" className="rounded-lg border border-edge px-3 py-1.5 text-sm">
                    Resolve
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
