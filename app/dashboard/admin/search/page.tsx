import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { OwnerOmniSearch } from "@/components/owner/owner-omni-search";

export const dynamic = "force-dynamic";

export default async function OwnerSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireOwner();
  const sp = await searchParams;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Search</h1>
          <p className="text-sm text-ink-soft">
            Paste a Stripe id, booking id, email or phone — every result shows which account it belongs to.
          </p>
        </div>
        <OwnerOmniSearch />
      </div>
      <OwnerNav />
      <OwnerOmniSearch embedded initialQuery={sp.q ?? ""} />
    </div>
  );
}
