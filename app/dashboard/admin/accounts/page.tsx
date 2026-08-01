import { PLATFORM_TZ } from "@/lib/locale";
import Link from "next/link";
import { requireOwner } from "@/lib/owner/require-owner";
import { listOwnerAccounts, signupOfferLabel, trialDaysLeft } from "@/lib/owner/accounts";
import { gbpFromPennies } from "@/lib/owner/mrr";
import { OwnerNav } from "@/components/owner/owner-nav";
import { AccountsTable, type AccountTableRow } from "@/components/owner/accounts-table";
import { listSavedViews, filtersToSearchParams } from "@/lib/owner/saved-views";
import { saveAccountViewAction, deleteAccountViewAction } from "../phase4-actions";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OwnerAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    sort?: string;
    status?: string;
    tag?: string;
    healthBand?: string;
    atRisk?: string;
    signupSince?: string;
    cols?: string;
    err?: string;
    ok?: string;
  }>;
}) {
  const { tech: admin } = await requireOwner();
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const sort =
    (sp.sort as "createdAt" | "businessName" | "status" | "health" | undefined) ?? "createdAt";
  const signupSinceDays = sp.signupSince ? Number(sp.signupSince) || undefined : undefined;
  const data = await listOwnerAccounts({
    q: sp.q,
    page,
    sort,
    status: sp.status || undefined,
    tag: sp.tag || undefined,
    healthBand: sp.healthBand || undefined,
    atRisk: sp.atRisk === "1",
    signupSinceDays,
  });
  const views = await listSavedViews(admin.email);
  const columns = sp.cols?.split(",").map((c) => c.trim()).filter(Boolean);

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const tableRows: AccountTableRow[] = data.rows.map((row) => {
    const days = trialDaysLeft(row.tech.trialEndsAt);
    return {
      id: row.tech.id,
      label: row.tech.businessName || row.tech.handle,
      handle: row.tech.handle,
      email: row.tech.email,
      offer: signupOfferLabel(row.tech),
      status: row.tech.subscriptionStatus,
      plan: row.tech.plan,
      healthScore: row.tech.healthScore ?? null,
      healthBand: row.tech.healthBand ?? null,
      trialEnds: row.tech.trialEndsAt ? fmtDate(row.tech.trialEndsAt, PLATFORM_TZ) : null,
      daysLeft: days == null ? "—" : String(days),
      firstCharge:
        row.tech.signupOffer === "trial" && row.tech.trialEndsAt ? fmtDate(row.tech.trialEndsAt, PLATFORM_TZ) : "—",
      mrr: row.mrrPennies ? gbpFromPennies(row.mrrPennies) : "—",
      staff: row.staffCount,
      clients: row.clientCount,
      bookings: row.bookingCount,
      connect: row.tech.connectChargesEnabled ? "Onboarded" : "Pending",
      joined: fmtDate(row.tech.createdAt, PLATFORM_TZ),
      flags: row.flags,
      tags: row.tech.ownerTags ?? [],
    };
  });

  const qsBase = filtersToSearchParams({
    q: sp.q,
    status: sp.status,
    tag: sp.tag,
    healthBand: sp.healthBand,
    atRisk: sp.atRisk === "1",
    signupSinceDays,
    sort,
  });
  const returnParams = new URLSearchParams(qsBase);
  if (data.page > 1) returnParams.set("page", String(data.page));
  if (columns?.length) returnParams.set("cols", columns.join(","));
  const returnTo = returnParams.toString()
    ? `/dashboard/admin/accounts?${returnParams.toString()}`
    : "/dashboard/admin/accounts";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Accounts</h1>
        <p className="text-sm text-ink-soft">
          Filters, saved views, bulk actions. Mobile cards at 390px; never bulk delete.
        </p>
      </div>
      <OwnerNav />

      <p className="rounded-xl border border-edge bg-surface px-4 py-3 text-sm">
        Accounts currently in trial: <strong>{data.trialingCount}</strong>
      </p>

      {sp.ok ? (
        <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">Saved ({sp.ok}).</p>
      ) : null}
      {sp.err === "confirm" ? (
        <p className="rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-warning-text">
          Type <strong>yes</strong> before running a bulk or owner action.
        </p>
      ) : null}

      <form className="flex flex-wrap gap-2 rounded-xl border border-edge bg-surface p-3">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search name, handle, email"
          className="min-w-[180px] flex-1 rounded-xl border border-edge px-3 py-2 text-sm"
        />
        <select name="status" defaultValue={sp.status ?? ""} className="rounded-xl border border-edge px-3 py-2 text-sm">
          <option value="">Any status</option>
          <option value="active">active</option>
          <option value="trialing">trialing</option>
          <option value="comped">comped</option>
          <option value="past_due">past_due</option>
          <option value="canceled">canceled</option>
          <option value="none">none</option>
        </select>
        <select
          name="healthBand"
          defaultValue={sp.healthBand ?? ""}
          className="rounded-xl border border-edge px-3 py-2 text-sm"
        >
          <option value="">Any health</option>
          <option value="healthy">healthy</option>
          <option value="watch">watch</option>
          <option value="at_risk">at_risk</option>
        </select>
        <input
          name="tag"
          defaultValue={sp.tag ?? ""}
          placeholder="tag"
          className="w-28 rounded-xl border border-edge px-3 py-2 text-sm"
        />
        <label className="inline-flex items-center gap-1 text-sm">
          <input type="checkbox" name="atRisk" value="1" defaultChecked={sp.atRisk === "1"} />
          At risk
        </label>
        <select name="sort" defaultValue={sort} className="rounded-xl border border-edge px-3 py-2 text-sm">
          <option value="createdAt">Newest</option>
          <option value="businessName">Name</option>
          <option value="status">Status</option>
          <option value="health">Health (worst first)</option>
        </select>
        <button type="submit" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white">
          Apply
        </button>
      </form>

      <div className="flex flex-wrap gap-2 text-sm">
        {views.map((v) => (
          <span key={v.id} className="inline-flex items-center gap-1 rounded-full border border-edge px-2 py-1">
            <Link
              href={`/dashboard/admin/accounts?${filtersToSearchParams({ ...v.filters, sort: v.sort })}${
                v.columns.length ? `&cols=${encodeURIComponent(v.columns.join(","))}` : ""
              }`}
              className="hover:underline"
            >
              {v.name}
            </Link>
            <form action={deleteAccountViewAction}>
              <input type="hidden" name="id" value={v.id} />
              <button type="submit" className="text-ink-faint hover:text-danger-text" title="Delete view">
                ×
              </button>
            </form>
          </span>
        ))}
        <form action={saveAccountViewAction} className="inline-flex flex-wrap items-center gap-1">
          <input type="hidden" name="q" value={sp.q ?? ""} />
          <input type="hidden" name="status" value={sp.status ?? ""} />
          <input type="hidden" name="tag" value={sp.tag ?? ""} />
          <input type="hidden" name="healthBand" value={sp.healthBand ?? ""} />
          <input type="hidden" name="atRisk" value={sp.atRisk === "1" ? "1" : ""} />
          <input type="hidden" name="sort" value={sort} />
          <input
            type="hidden"
            name="columns"
            value={(columns ?? ["account", "offer", "status", "health", "mrr", "joined", "flags"]).join(",")}
          />
          <input
            name="name"
            placeholder="Save view as…"
            className="w-36 rounded-lg border border-edge px-2 py-1 text-sm"
          />
          <button type="submit" className="rounded-lg border border-edge px-2 py-1 text-sm">
            Save
          </button>
        </form>
      </div>

      <AccountsTable rows={tableRows} columns={columns} returnTo={returnTo} />

      <div className="flex items-center justify-between text-sm text-ink-soft">
        <span>
          Page {data.page} of {totalPages} · {data.total} accounts
        </span>
        <div className="flex gap-2">
          {data.page > 1 ? (
            <Link
              href={`/dashboard/admin/accounts?page=${data.page - 1}&${qsBase}`}
              className="rounded-lg border border-edge px-3 py-1.5 hover:bg-fill-hover"
            >
              Previous
            </Link>
          ) : null}
          {data.page < totalPages ? (
            <Link
              href={`/dashboard/admin/accounts?page=${data.page + 1}&${qsBase}`}
              className="rounded-lg border border-edge px-3 py-1.5 hover:bg-fill-hover"
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
