import Link from "next/link";
import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { listOwnerAudit } from "@/lib/owner/audit-export";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OwnerAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; action?: string; targetId?: string; export?: string }>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const rows = await listOwnerAudit({
    q: sp.q?.trim() || undefined,
    action: sp.action?.trim() || undefined,
    targetId: sp.targetId?.trim() || undefined,
    limit: sp.export === "1" ? 2000 : 120,
  });

  if (sp.export === "1") {
    // Server component cannot stream a download easily — link to API route instead.
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Owner audit</h1>
        <p className="text-sm text-ink-soft">
          Immutable privileged actions. Searchable and exportable. Rows cannot be updated or deleted.
        </p>
      </div>
      <OwnerNav />

      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={sp.q || ""}
          placeholder="Actor / action / target…"
          className="min-w-[180px] flex-1 rounded-xl border border-edge px-3 py-2 text-sm"
        />
        <input
          name="action"
          defaultValue={sp.action || ""}
          placeholder="Exact action"
          className="min-w-[140px] rounded-xl border border-edge px-3 py-2 text-sm"
        />
        <input
          name="targetId"
          defaultValue={sp.targetId || ""}
          placeholder="Target id"
          className="min-w-[160px] rounded-xl border border-edge px-3 py-2 font-mono text-xs"
        />
        <button type="submit" className="rounded-xl bg-brand-600 px-4 py-2 text-sm text-white">
          Search
        </button>
        <Link
          href={`/api/owner/audit-export?${new URLSearchParams({
            ...(sp.q ? { q: sp.q } : {}),
            ...(sp.action ? { action: sp.action } : {}),
            ...(sp.targetId ? { targetId: sp.targetId } : {}),
          }).toString()}`}
          className="rounded-xl border border-edge px-4 py-2 text-sm"
        >
          Export JSON
        </Link>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-soft">No audit rows match.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-edge">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-cream text-left text-xs text-ink-faint">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Target</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-edge align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-faint">
                    {fmtDateTime(r.createdAt)}
                  </td>
                  <td className="px-3 py-2">{r.actorEmail}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                  <td className="px-3 py-2">
                    {r.targetId ? (
                      <Link
                        href={`/dashboard/admin/accounts/${r.targetId}`}
                        className="text-brand-text hover:underline"
                      >
                        {r.targetType}:{r.targetId.slice(0, 12)}…
                      </Link>
                    ) : (
                      r.targetType
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
