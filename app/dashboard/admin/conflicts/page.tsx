import Link from "next/link";
import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { OwnerOmniSearch } from "@/components/owner/owner-omni-search";
import { detectConflicts } from "@/lib/owner/conflicts";

export const dynamic = "force-dynamic";

export default async function ConflictsPage() {
  await requireOwner();
  const rows = await detectConflicts();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Duplicates & conflicts</h1>
          <p className="text-sm text-ink-soft">
            Shared emails, near-identical names, duplicate clients, orphan bookings.
          </p>
        </div>
        <OwnerOmniSearch />
      </div>
      <OwnerNav />

      <p className="text-sm text-ink-soft">{rows.length} issue{rows.length === 1 ? "" : "s"} found</p>
      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-edge bg-surface px-4 py-3 text-sm text-ink-faint">
            No conflicts on the scanned sample.
          </p>
        ) : (
          rows.map((r, i) => (
            <div key={`${r.rule}-${i}`} className="rounded-xl border border-edge bg-surface px-4 py-3 text-sm">
              <p className="font-medium">{r.title}</p>
              <p className="text-xs text-ink-faint">
                {r.rule} · {r.detail}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {r.hrefs.map((h) => (
                  <Link key={h.href + h.label} href={h.href} className="text-brand-text underline-offset-2 hover:underline">
                    {h.label}
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
