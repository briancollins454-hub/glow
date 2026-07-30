import { PLATFORM_TZ } from "@/lib/locale";
import Link from "next/link";
import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { listPlatformEvents } from "@/lib/owner/events";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OwnerEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; techId?: string; severity?: string; q?: string }>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const events = await listPlatformEvents({
    type: sp.type?.trim() || undefined,
    techId: sp.techId?.trim() || undefined,
    severity: sp.severity?.trim() || undefined,
    q: sp.q?.trim() || undefined,
    limit: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Platform events</h1>
        <p className="text-sm text-ink-soft">
          Chronological river (90-day window). Filter by type, account, severity, or title search.
        </p>
      </div>
      <OwnerNav />

      <form className="flex flex-wrap gap-2">
        <input
          name="type"
          defaultValue={sp.type || ""}
          placeholder="Type (e.g. signup)"
          className="min-w-[140px] flex-1 rounded-xl border border-edge px-3 py-2 text-sm"
        />
        <input
          name="techId"
          defaultValue={sp.techId || ""}
          placeholder="Tech id"
          className="min-w-[180px] flex-1 rounded-xl border border-edge px-3 py-2 font-mono text-xs"
        />
        <select
          name="severity"
          defaultValue={sp.severity || ""}
          className="rounded-xl border border-edge px-3 py-2 text-sm"
        >
          <option value="">Any severity</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
        </select>
        <input
          name="q"
          defaultValue={sp.q || ""}
          placeholder="Title contains…"
          className="min-w-[160px] flex-1 rounded-xl border border-edge px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-xl bg-brand-600 px-4 py-2 text-sm text-white">
          Filter
        </button>
      </form>

      {events.length === 0 ? (
        <p className="rounded-xl border border-edge bg-surface px-4 py-6 text-sm text-ink-soft">
          No events match.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-edge">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-cream text-left text-xs text-ink-faint">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Sev</th>
                <th className="px-3 py-2">Account</th>
                <th className="px-3 py-2">Title</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-edge">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-faint">
                    {fmtDateTime(e.createdAt, PLATFORM_TZ)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{e.type}</td>
                  <td className="px-3 py-2">
                    <Badge tone={e.severity === "error" ? "amber" : "neutral"}>{e.severity}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    {e.techId ? (
                      <Link
                        href={`/dashboard/admin/accounts/${e.techId}`}
                        className="text-brand-text hover:underline"
                      >
                        {e.techId.slice(0, 8)}…
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">{e.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
