import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { supabaseService } from "@/lib/supabase/service";
import { getBookingByApprovalToken, getClient, getService, getTechById } from "@/lib/db/queries";
import { fmtDateTime, gbp } from "@/lib/format";
import { approveBookingFromEmailAction, declineBookingFromEmailAction } from "./actions";

export const metadata = { robots: { index: false, follow: false } };

export default async function ApproveBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const { done } = await searchParams;
  const sb = supabaseService();
  const booking = await getBookingByApprovalToken(sb, token);
  if (!booking) notFound();

  const [tech, service, client] = await Promise.all([
    getTechById(sb, booking.techId),
    getService(sb, booking.serviceId),
    getClient(sb, booking.clientId),
  ]);
  if (!tech || !service || !client) notFound();

  const brand = tech.brandColor || "#db2777";
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
            <Row label="Client" value={client.name} />
            <Row label="Service" value={service.name} />
            <Row label="When" value={fmtDateTime(booking.startIso)} />
            <Row label="Total" value={gbp(booking.pricePennies)} />
            {booking.depositPennies > 0 && (
              <Row label="Deposit after approval" value={gbp(booking.depositPennies)} />
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
              href="/dashboard/bookings"
              className="flex w-full items-center justify-center rounded-xl border border-edge py-3 text-sm font-medium text-ink-soft hover:bg-white/[0.06]"
            >
              Open dashboard
            </Link>
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
