import Link from "next/link";
import { requireOwner } from "@/lib/owner/require-owner";
import { ownerSb } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { suggestInternalAccounts, shouldIncludeInternal } from "@/lib/owner/internal-accounts";
import { setInternalFlagAction, setIncludeInternalToggleAction } from "../internal-actions";

export const dynamic = "force-dynamic";

export default async function InternalAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const sb = ownerSb();
  const include = await shouldIncludeInternal(sb);
  const suggested = await suggestInternalAccounts(sb);
  const { data: marked } = await sb
    .from("techs")
    .select("id, businessName, handle, email")
    .eq("isInternal", true)
    .order("businessName")
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Internal accounts</h1>
        <p className="text-sm text-ink-soft">
          Test/staff accounts are excluded from metrics by default. Suggestions are never auto-applied.
        </p>
      </div>
      <OwnerNav />

      {sp.ok ? (
        <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">Saved ({sp.ok}).</p>
      ) : null}

      <form
        action={setIncludeInternalToggleAction}
        className="flex flex-wrap items-end gap-2 rounded-xl border border-edge bg-surface p-4"
      >
        <input type="hidden" name="enabled" value={include ? "0" : "1"} />
        <p className="w-full text-sm">
          Metrics currently <strong>{include ? "include" : "exclude"}</strong> internal accounts.
        </p>
        <div>
          <label className="block text-xs text-ink-faint">Type yes</label>
          <input name="confirm" placeholder="type yes" className="mt-1 w-20 rounded-lg border border-edge bg-cream px-2 py-1 text-sm" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" />
        </div>
        <button type="submit" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white">
          {include ? "Exclude internals from metrics" : "Include internals in metrics"}
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Currently marked internal ({(marked ?? []).length})</h2>
        {(marked ?? []).length === 0 ? (
          <p className="text-sm text-ink-faint">None.</p>
        ) : (
          (marked ?? []).map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-edge px-3 py-2 text-sm">
              <Link href={`/dashboard/admin/accounts/${t.id}`} className="hover:underline">
                {t.businessName || t.handle} · {t.email}
              </Link>
              <form action={setInternalFlagAction} className="flex items-end gap-2">
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="internal" value="0" />
                <input name="confirm" placeholder="type yes" className="w-16 rounded-lg border border-edge px-2 py-1 text-sm" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" />
                <button type="submit" className="rounded-lg border border-edge px-2 py-1 text-xs">
                  Unmark
                </button>
              </form>
            </div>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Suggested to mark</h2>
        <p className="text-xs text-ink-faint">
          Handles/emails matching test/demo patterns or the platform owner address. Confirm each one.
        </p>
        {suggested.length === 0 ? (
          <p className="text-sm text-ink-faint">No suggestions.</p>
        ) : (
          suggested.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-edge px-3 py-2 text-sm">
              <div>
                <Link href={`/dashboard/admin/accounts/${t.id}`} className="font-medium hover:underline">
                  {t.businessName || t.handle}
                </Link>
                <p className="text-xs text-ink-faint">
                  /{t.handle} · {t.email}
                </p>
              </div>
              <form action={setInternalFlagAction} className="flex items-end gap-2">
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="internal" value="1" />
                <input name="confirm" placeholder="type yes" className="w-16 rounded-lg border border-edge px-2 py-1 text-sm" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" />
                <button type="submit" className="rounded-lg bg-brand-600 px-2 py-1 text-xs text-white">
                  Mark internal
                </button>
              </form>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
