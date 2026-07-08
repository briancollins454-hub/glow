import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, CheckCircle2, CalendarHeart, CreditCard, Clock, XCircle } from "lucide-react";
import { supabaseService } from "@/lib/supabase/service";
import { getBookingByToken, getService, getTechByHandle } from "@/lib/db/queries";
import { isValidPublicHandle } from "@/lib/utils";
import { confirmCheckoutPaid } from "@/lib/payments";
import { applyDepositPaid } from "@/lib/bookings";
import { gbp, fmtDateTime } from "@/lib/format";
import { cancelClientBookingAction } from "./actions";

export const metadata = { robots: { index: false, follow: false } };

export default async function BookedPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string; token: string }>;
  searchParams: Promise<{ session_id?: string; cancelled?: string }>;
}) {
  const { handle, token } = await params;
  const { session_id, cancelled } = await searchParams;
  if (!isValidPublicHandle(handle)) notFound();
  const sb = supabaseService();
  const [tech, initialBooking] = await Promise.all([
    getTechByHandle(sb, handle),
    getBookingByToken(sb, token),
  ]);
  if (!tech || !initialBooking || initialBooking.techId !== tech.id) notFound();

  let booking = initialBooking;
  // Verify the deposit payment when returning from Stripe Checkout (with retry).
  if (session_id && booking.depositStatus !== "paid") {
    const { paid, paymentIntentId } = await confirmCheckoutPaid(tech, session_id);
    if (paid) {
      await applyDepositPaid(sb, booking, paymentIntentId);
      booking = (await getBookingByToken(sb, token)) ?? booking;
    }
  }

  const service = await getService(sb, booking.serviceId);
  const brand = tech.brandColor || "#db2777";
  const awaitingDeposit = booking.status === "pending" && booking.depositPennies > 0;
  const canSelfCancel =
    booking.status !== "cancelled" &&
    booking.status !== "completed" &&
    booking.status !== "no_show" &&
    new Date(booking.startIso).getTime() > Date.now();

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="card overflow-hidden">
          <div className="px-6 py-8 text-center text-white" style={{ backgroundColor: brand }}>
            {awaitingDeposit ? (
              <>
                <Clock className="mx-auto h-12 w-12" />
                <h1 className="mt-3 font-display text-2xl font-semibold">Almost there…</h1>
                <p className="mt-1 text-sm text-white/85">
                  We&apos;re confirming your deposit. Refresh in a moment if this doesn&apos;t update.
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 className="mx-auto h-12 w-12" />
                <h1 className="mt-3 font-display text-2xl font-semibold">You&apos;re booked in!</h1>
                <p className="mt-1 text-sm text-white/85">A confirmation has been sent to you.</p>
              </>
            )}
          </div>
          <div className="space-y-4 p-6">
            <Row label="Service" value={service?.name ?? "Appointment"} />
            <Row label="When" value={fmtDateTime(booking.startIso)} />
            <Row label="With" value={tech.businessName} />
            <hr className="border-edge" />
            <Row label="Total" value={gbp(booking.pricePennies)} />
            <Row label="Deposit paid" value={booking.depositStatus === "paid" ? gbp(booking.depositPennies) : "-"} />
            <Row label="Balance due on the day" value={gbp(booking.balancePennies)} strong />
            {(cancelled || booking.status === "cancelled") && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-300">
                <XCircle className="h-4 w-4" /> This booking has been cancelled.
              </div>
            )}
            {booking.status !== "cancelled" && booking.balancePennies > 0 && booking.balanceStatus !== "paid" && !awaitingDeposit && (
              <Link href={`/pay/${booking.balanceToken}`} className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white" style={{ backgroundColor: brand }}>
                <CreditCard className="h-4 w-4" /> Pay balance now (optional)
              </Link>
            )}
            <Link href={`/api/bookings/${booking.balanceToken}/calendar`} className="flex w-full items-center justify-center gap-2 rounded-xl border border-edge py-3 text-sm font-medium text-ink-soft hover:bg-white/[0.06]">
              <CalendarPlus className="h-4 w-4" /> Add to calendar
            </Link>
            {canSelfCancel && (
              <form action={cancelClientBookingAction}>
                <input type="hidden" name="handle" value={tech.handle} />
                <input type="hidden" name="token" value={booking.balanceToken} />
                <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 py-3 text-sm font-medium text-red-300 hover:bg-red-500/10">
                  <XCircle className="h-4 w-4" /> Cancel booking
                </button>
                <p className="mt-2 text-center text-xs text-ink-faint">
                  Cancellations inside {tech.cancellationWindowHours}h may forfeit your deposit.
                </p>
              </form>
            )}
            <Link href={`/${tech.handle}`} className="flex w-full items-center justify-center gap-2 rounded-xl border border-edge py-3 text-sm font-medium text-ink-soft hover:bg-white/[0.06]">Back to {tech.businessName}</Link>
          </div>
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-ink-faint"><CalendarHeart className="h-3.5 w-3.5" /> Powered by Glow</p>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-faint">{label}</span>
      <span className={strong ? "text-base font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}
