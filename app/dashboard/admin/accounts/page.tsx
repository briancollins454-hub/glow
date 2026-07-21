import Link from "next/link";
import { requireOwner } from "@/lib/owner/require-owner";
import { listOwnerAccounts } from "@/lib/owner/accounts";
import { gbpFromPennies } from "@/lib/owner/mrr";
import { OwnerNav } from "@/components/owner/owner-nav";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const FLAG_LABEL: Record<string, string> = {
  connect_pending: "Connect pending",
  no_services: "No services",
  no_bookings: "No bookings",
  past_due: "Past due",
  closure_requested: "Closure requested",
};

export default async function OwnerAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; err?: string }>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const sort = (sp.sort as "createdAt" | "businessName" | "status" | undefined) ?? "createdAt";
  const data = await listOwnerAccounts({ q: sp.q, page, sort });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Accounts</h1>
        <p className="text-sm text-ink-soft">Searchable directory. Drill in for support actions.</p>
      </div>
      <OwnerNav />

      {sp.err === "confirm" ? (
        <p className="rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-warning-text">
          Type <strong>yes</strong> in the confirm box before running an owner action.
        </p>
      ) : null}

      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search name, handle, email"
          className="min-w-[220px] flex-1 rounded-xl border border-edge bg-surface px-3 py-2 text-sm"
        />
        <select
          name="sort"
          defaultValue={sort}
          className="rounded-xl border border-edge bg-surface px-3 py-2 text-sm"
        >
          <option value="createdAt">Newest</option>
          <option value="businessName">Name</option>
          <option value="status">Status</option>
        </select>
        <button type="submit" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white">
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-edge">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-fill text-xs text-ink-faint">
            <tr>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">MRR</th>
              <th className="px-3 py-2">Staff</th>
              <th className="px-3 py-2">Clients</th>
              <th className="px-3 py-2">Bookings</th>
              <th className="px-3 py-2">Connect</th>
              <th className="px-3 py-2">Joined</th>
              <th className="px-3 py-2">Flags</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.tech.id} className="border-t border-edge">
                <td className="px-3 py-2">
                  <Link href={`/dashboard/admin/accounts/${row.tech.id}`} className="font-medium hover:underline">
                    {row.tech.businessName || row.tech.handle}
                  </Link>
                  <p className="text-xs text-ink-faint">
                    /{row.tech.handle} · {row.tech.email}
                  </p>
                </td>
                <td className="px-3 py-2">
                  <Badge tone="neutral">{row.tech.subscriptionStatus}</Badge>
                  {row.tech.plan ? <span className="ml-1 text-xs text-ink-faint">{row.tech.plan}</span> : null}
                </td>
                <td className="px-3 py-2">{row.mrrPennies ? gbpFromPennies(row.mrrPennies) : "—"}</td>
                <td className="px-3 py-2">{row.staffCount}</td>
                <td className="px-3 py-2">{row.clientCount}</td>
                <td className="px-3 py-2">{row.bookingCount}</td>
                <td className="px-3 py-2">
                  {row.tech.connectChargesEnabled ? (
                    <Badge tone="green">Onboarded</Badge>
                  ) : (
                    <Badge tone="amber">Pending</Badge>
                  )}
                </td>
                <td className="px-3 py-2">{fmtDate(row.tech.createdAt)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {row.flags.map((f) => (
                      <Badge key={f} tone="amber">
                        {FLAG_LABEL[f] ?? f}
                      </Badge>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <p className="text-ink-faint">
          {data.total} account{data.total === 1 ? "" : "s"} · page {data.page} of {totalPages}
        </p>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              className="rounded-lg border border-edge px-3 py-1.5"
              href={`/dashboard/admin/accounts?q=${encodeURIComponent(sp.q ?? "")}&sort=${sort}&page=${page - 1}`}
            >
              Previous
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link
              className="rounded-lg border border-edge px-3 py-1.5"
              href={`/dashboard/admin/accounts?q=${encodeURIComponent(sp.q ?? "")}&sort=${sort}&page=${page + 1}`}
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
