import Link from "next/link";
import { requireOwner } from "@/lib/owner/require-owner";
import { OwnerNav } from "@/components/owner/owner-nav";
import { searchClientsAcrossPlatform } from "@/lib/owner/gdpr";

export const dynamic = "force-dynamic";

export default async function OwnerGdprPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; techId?: string }>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const hits = q.length >= 3 ? await searchClientsAcrossPlatform(q, 40) : [];
  const techId = sp.techId?.trim() || "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">GDPR / SAR</h1>
        <p className="text-sm text-ink-soft">
          Platform-wide client search for subject access requests, plus per-account export. Consent
          records are immutable and never bulk-deleted.
        </p>
      </div>
      <OwnerNav />

      <section className="rounded-xl border border-edge bg-surface p-4">
        <h2 className="font-display text-lg font-semibold">Client SAR search</h2>
        <form className="mt-3 flex flex-wrap gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Name, email, phone, or client id (min 3 chars)"
            className="min-w-[240px] flex-1 rounded-lg border border-edge px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">
            Search
          </button>
        </form>
        {q.length > 0 && q.length < 3 ? (
          <p className="mt-2 text-sm text-warning-text">Enter at least 3 characters.</p>
        ) : null}
        {hits.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm">
            {hits.map((h) => (
              <li key={h.clientId} className="rounded-lg border border-edge px-3 py-2">
                <span className="font-medium">{h.name || "(no name)"}</span>
                <span className="text-ink-soft">
                  {" "}
                  · {h.email || "—"} · {h.phone || "—"}
                </span>
                <div className="text-xs text-ink-faint">
                  {h.clientId} ·{" "}
                  <Link
                    href={`/dashboard/admin/accounts/${h.techId}`}
                    className="text-brand-text hover:underline"
                  >
                    {h.techLabel}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : q.length >= 3 ? (
          <p className="mt-3 text-sm text-ink-soft">No clients match.</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-edge bg-surface p-4">
        <h2 className="font-display text-lg font-semibold">Account GDPR export</h2>
        <p className="text-sm text-ink-soft">
          Download JSON archive: account, staff, clients, bookings, payments, consents, messages.
        </p>
        <form method="get" action="/api/owner/gdpr-export" className="mt-3 flex flex-wrap gap-2">
          <input
            name="techId"
            defaultValue={techId}
            required
            placeholder="Tech id"
            className="min-w-[220px] flex-1 rounded-lg border border-edge px-3 py-2 font-mono text-xs"
          />
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">
            Download export
          </button>
        </form>
        <p className="mt-3 text-xs text-ink-faint">
          Account deletion remains on the account detail page with a handle confirmation gate and audit
          entry. Consent rows are retained.
        </p>
      </section>
    </div>
  );
}
