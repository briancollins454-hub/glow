import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOwner } from "@/lib/owner/require-owner";
import { getTechById } from "@/lib/db/queries";
import { supabaseService } from "@/lib/supabase/service";
import { getActiveViewAsSession } from "@/lib/owner/view-as";
import { OwnerNav } from "@/components/owner/owner-nav";
import { fmtDate } from "@/lib/format";
import { PLATFORM_TZ } from "@/lib/locale";
import { acceptsOnlineBookings, isLive } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

/**
 * Read-only "view as account" entry. Mutations are blocked in middleware + assertNotViewAs.
 * Shows a snapshot of the account's dashboard data with a persistent banner.
 */
export default async function ViewAsPage({ params }: { params: Promise<{ id: string }> }) {
  const { tech: admin } = await requireOwner();
  const { id } = await params;
  const session = await getActiveViewAsSession();
  if (!session || session.techId !== id) {
    redirect(`/dashboard/admin/accounts/${id}`);
  }
  const tech = await getTechById(supabaseService(), id);
  if (!tech) notFound();

  const sb = supabaseService();
  const [services, clients, bookings, staff] = await Promise.all([
    sb.from("services").select("id, name, active, pricePennies").eq("techId", id).order("sortOrder").limit(20),
    sb.from("clients").select("id", { count: "exact", head: true }).eq("techId", id),
    sb
      .from("bookings")
      .select("id, startIso, status, pricePennies")
      .eq("techId", id)
      .order("startIso", { ascending: false })
      .limit(15),
    sb.from("staff_members").select("id, name, email, active").eq("techId", id).limit(20),
  ]);

  return (
    <div className="min-h-screen bg-cream">
      <div className="sticky top-0 z-50 border-b-2 border-amber-500 bg-amber-500 text-amber-950">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-3 text-sm font-semibold">
          <span>
            Viewing as {tech.businessName || tech.handle} — read only (session for {admin.email})
          </span>
          {/* Exit must POST via the dedicated allow-listed route (server actions post to the current URL). */}
          <Link
            href="/dashboard/admin/accounts/view-as-exit"
            className="rounded-lg bg-amber-950 px-3 py-1.5 text-amber-50"
          >
            Exit view-as
          </Link>
        </div>
      </div>

      <div className="container-page space-y-6 py-6">
        <OwnerNav />
        <div>
          <Link href={`/dashboard/admin/accounts/${id}`} className="text-sm text-brand-text hover:underline">
            ← Account detail
          </Link>
          <h1 className="mt-2 font-display text-2xl font-semibold">{tech.businessName}</h1>
          <p className="text-sm text-ink-soft">
            /{tech.handle} · {tech.email} · {tech.subscriptionStatus}
            {isLive(tech) ? " · live" : " · not live"}
            {acceptsOnlineBookings(tech) ? " · accepting bookings" : " · not accepting"}
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            Expires {fmtDate(session.expiresAt, PLATFORM_TZ)}. No emails, SMS, Stripe calls, or writes are possible from this
            session.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Clients" value={String(clients.count ?? 0)} />
          <Stat label="Services shown" value={String((services.data ?? []).length)} />
          <Stat label="Staff" value={String((staff.data ?? []).length)} />
        </div>

        <section className="rounded-xl border border-edge bg-surface p-4">
          <h2 className="font-display text-lg font-semibold">Services</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {(services.data ?? []).map((s) => (
              <li key={s.id}>
                {s.name} · £{((s.pricePennies ?? 0) / 100).toFixed(2)}
                {!s.active ? " (off)" : ""}
              </li>
            ))}
            {(services.data ?? []).length === 0 ? <li className="text-ink-faint">None</li> : null}
          </ul>
        </section>

        <section className="rounded-xl border border-edge bg-surface p-4">
          <h2 className="font-display text-lg font-semibold">Recent bookings</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {(bookings.data ?? []).map((b) => (
              <li key={b.id}>
                {b.startIso} · {b.status} · £{((b.pricePennies ?? 0) / 100).toFixed(2)}
              </li>
            ))}
            {(bookings.data ?? []).length === 0 ? <li className="text-ink-faint">None</li> : null}
          </ul>
        </section>

        <section className="rounded-xl border border-edge bg-surface p-4">
          <h2 className="font-display text-lg font-semibold">Staff</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {(staff.data ?? []).map((s) => (
              <li key={s.id}>
                {s.name} · {s.email}
                {!s.active ? " (inactive)" : ""}
              </li>
            ))}
            {(staff.data ?? []).length === 0 ? <li className="text-ink-faint">None</li> : null}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-4">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
