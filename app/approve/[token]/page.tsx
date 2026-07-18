import Link from "next/link";
import { heroBrand } from "@/lib/booking/brand";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { supabaseService } from "@/lib/supabase/service";
import { bookingsForClient, getBookingByApprovalToken, getBooking, getClient, getService, getTechById, listBookingsByGroup } from "@/lib/db/queries";
import { fmtDateTime, gbp } from "@/lib/format";
import { riskTierLabel, riskTierTone } from "@/lib/rules";
import { rateLimit } from "@/lib/rate-limit";
import { approveBookingFromEmailAction, declineBookingFromEmailAction } from "./actions";
import { ApproveDoneRedirect } from "@/components/booking/approve-done-redirect";
import { ClientRiskSummary } from "@/components/dashboard/client-risk-summary";
import { Badge } from "@/components/ui/badge";

export const metadata = { robots: { index: false, follow: false } };

export default async function ApproveBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string; bid?: string; err?: string }>;
}) {
  const { token } = await params;
  const { done, bid, err } = await searchParams;
  if (!(await rateLimit("token-lookup", { limit: 30, windowMs: 60_000 })).ok || err === "rate") {
    return (
      <div className="grid min-h-screen place-items-center bg-cream px-4 py-10 text-center text-sm text-ink-soft">
        Too many attempts, try again shortly.
      </div>
    );
  }
  const sb = supabaseService();

  let booking = await getBookingByApprovalToken(sb, token);
  if (!booking && bid && (done === "approved" || done === "declined")) {
    booking = await getBooking(sb, bid);
  }
  if (!booking) notFound();

  const [tech, service, client] = await Promise.all([
    getTechById(sb, booking.techId),
    getService(sb, booking.serviceId),
    getClient(sb, booking.clientId),
  ]);
  if (!tech || !service || !client) notFound();

  // Basket visit: show every treatment the client asked for.
  let visitServiceNames: string[] = [];
  if (booking.groupId) {
    const group = await listBookingsByGroup(sb, booking.groupId);
    if (group.length > 1) {
      visitServiceNames = (
        await Promise.all(group.map((b) => getService(sb, b.serviceId)))
      ).map((s) => s?.name ?? "Treatment");
    }
  }

  const priorBookings = await bookingsForClient(sb, tech.id, client.id);
  const completedVisits = priorBookings.filter((b) => b.status === "completed").length;

  const brand = heroBrand(tech.brandColor || "#db2777");
  const resolved = done === "approved" || done === "declined" || booking.status !== "pending_approval";

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="card overflow-hidden">
          <div className="px-6 py-7 text-white" style={{ backgroundColor: brand }}>
            {done === "approved" || (resolved && booking.status !== "cancelled" && booking.status !== "pending_approval") ? (
              <>
                <CheckCircle2 className="mx-auto h-12 w-12" />
                <h1 className="mt-3 font-display text-2xl font-semibold">Approved</h1>
                <p className="mt-1 text-sm text-white/85">
                  {client.name} has been emailed{booking.depositPennies > 0 ? " with a deposit link" : ""}.
                </p>
              </>
            ) : done === "declined" || booking.status === "cancelled" ? (
              <>
                <XCircle className="mx-auto h-12 w-12" />
                <h1 className="mt-3 font-display text-2xl font-semibold">Declined</h1>
                <p className="mt-1 text-sm text-white/85">{client.name} has been notified.</p>
              </>
            ) : (
              <>
                <Clock className="mx-auto h-12 w-12" />
                <h1 className="mt-3 font-display text-2xl font-semibold">Booking request</h1>
                <p className="mt-1 text-sm text-white/85">Approve to let {client.name} pay their deposit.</p>
              </>
            )}
          </div>
          <div className="space-y-4 p-6">
            <ClientRiskSummary
              client={client}
              completedVisits={completedVisits}
              riskTier={booking.riskTier}
            />
            <Row
              label={visitServiceNames.length > 1 ? "Treatments" : "Service"}
              value={visitServiceNames.length > 1 ? visitServiceNames.join(" + ") : service.name}
            />
            <Row label="When" value={fmtDateTime(booking.startIso)} />
            <Row label="Total" value={gbp(booking.pricePennies)} />
            {booking.depositPennies > 0 && (
              <Row label="Deposit after approval" value={gbp(booking.depositPennies)} />
            )}
            {booking.riskTier && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-faint">Risk tier</span>
                <Badge tone={riskTierTone(booking.riskTier)}>{riskTierLabel(booking.riskTier)}</Badge>
              </div>
            )}
            {!resolved && booking.status === "pending_approval" && (
              <div className="grid gap-2 pt-2">
                <form action={approveBookingFromEmailAction}>
                  <input type="hidden" name="token" value={token} />
                  <button
                    type="submit"
                    className="w-full rounded-xl py-3 font-semibold text-white"
                    style={{ backgroundColor: brand }}
                  >
                    Approve booking
                  </button>
                </form>
                <form action={declineBookingFromEmailAction}>
                  <input type="hidden" name="token" value={token} />
                  <button
                    type="submit"
                    className="w-full rounded-xl border border-edge py-3 text-sm font-medium text-red-300 hover:bg-red-500/10"
                  >
                    Decline
                  </button>
                </form>
              </div>
            )}
            <Link
              href={`/dashboard/bookings/${booking.id}`}
              className="flex w-full items-center justify-center rounded-xl border border-edge py-3 text-sm font-medium text-ink-soft hover:bg-white/[0.06]"
            >
              Open in dashboard
            </Link>
            <ApproveDoneRedirect
              bookingId={booking.id}
              enabled={done === "approved" || done === "declined"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-faint">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
