import Link from "next/link";
import { heroBrand } from "@/lib/booking/brand";
import { notFound } from "next/navigation";
import { CalendarPlus, CheckCircle2, CalendarHeart, CreditCard, Clock, XCircle } from "lucide-react";
import { supabaseService } from "@/lib/supabase/service";
import {
  getBookingByToken,
  getService,
  getTechByHandle,
  listBookingsByGroup,
} from "@/lib/db/queries";
import { confirmCheckoutPaid, confirmCheckoutSetup, checkoutMatchesDeposit } from "@/lib/payments";
import { applyCardCaptured, applyDepositPaid } from "@/lib/bookings";
import { gbp, fmtDateTime, fmtTime } from "@/lib/format";
import { cancelClientBookingAction, payDepositAction, saveCardAction } from "./actions";
import { isPaymentsReady, usesCardCapture } from "@/lib/subscriptions";
import { noShowFeeFor } from "@/lib/rules";
import type { Booking } from "@/lib/db/types";
import { BookingThemedPage } from "@/components/theme/booking-themed-page";

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
  const sb = supabaseService();
  const [tech, initialBooking] = await Promise.all([
    getTechByHandle(sb, handle),
    getBookingByToken(sb, token),
  ]);
  if (!tech || !initialBooking || initialBooking.techId !== tech.id) notFound();

  let booking = initialBooking;

  // Basket visits: the token may belong to any treatment in the group, but all
  // money lives on the primary (earliest) booking.
  let group: Booking[] = [];
  if (booking.groupId) {
    group = await listBookingsByGroup(sb, booking.groupId);
    booking = group[0] ?? booking;
  }

  // Verify the deposit payment when returning from Stripe Checkout (with retry).
  if (session_id && booking.depositPennies > 0 && booking.depositStatus !== "paid") {
    const result = await confirmCheckoutPaid(tech, session_id);
    if (checkoutMatchesDeposit(result, booking)) {
      await applyDepositPaid(sb, booking, result.paymentIntentId);
      booking = (await getBookingByToken(sb, booking.balanceToken)) ?? booking;
      if (booking.groupId) group = await listBookingsByGroup(sb, booking.groupId);
    }
  }

  // Card capture mode: verify the card was saved when returning from Stripe.
  if (session_id && !booking.cardPaymentMethodId && usesCardCapture(tech)) {
    const result = await confirmCheckoutSetup(tech, session_id);
    if (result.complete && result.bookingId === booking.id && result.kind === "card_capture") {
      await applyCardCaptured(sb, booking, result.customerId, result.paymentMethodId);
      booking = (await getBookingByToken(sb, booking.balanceToken)) ?? booking;
      if (booking.groupId) group = await listBookingsByGroup(sb, booking.groupId);
    }
  }

  const service = await getService(sb, booking.serviceId);
  const groupServices =
    group.length > 1
      ? await Promise.all(
          group.map(async (b) => ({
            booking: b,
            service: await getService(sb, b.serviceId),
          })),
        )
      : [];
  const brand = heroBrand(tech.brandColor || "#db2777");
  const needsDeposit =
    booking.status === "pending" && booking.depositPennies > 0 && booking.depositStatus !== "paid";
  const needsCard =
    booking.status === "pending" &&
    !needsDeposit &&
    usesCardCapture(tech) &&
    !booking.cardPaymentMethodId;
  const awaitingStripeReturn = (needsDeposit || needsCard) && !!session_id;
  const noShowFee = noShowFeeFor(tech, booking.pricePennies);
  const canSelfCancel =
    booking.status !== "cancelled" &&
    booking.status !== "completed" &&
    booking.status !== "no_show" &&
    new Date(booking.startIso).getTime() > Date.now();

  return (
    <BookingThemedPage preference={tech.bookingTheme}>
    <div className="grid min-h-screen place-items-center bg-cream px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="card overflow-hidden">
          <div className="px-6 py-8 text-center text-white" style={{ backgroundColor: brand }}>
            {awaitingStripeReturn ? (
              <>
                <Clock className="mx-auto h-12 w-12" />
                <h1 className="mt-3 font-display text-2xl font-semibold">Almost there…</h1>
                <p className="mt-1 text-sm text-white/85">
                  We&apos;re confirming your {needsCard ? "card details" : "deposit"}. Refresh in a
                  moment if this doesn&apos;t update.
                </p>
              </>
            ) : needsDeposit ? (
              <>
                <Clock className="mx-auto h-12 w-12" />
                <h1 className="mt-3 font-display text-2xl font-semibold">Approved — pay deposit</h1>
                <p className="mt-1 text-sm text-white/85">
                  Pay now to secure your slot with {tech.businessName}.
                </p>
              </>
            ) : needsCard ? (
              <>
                <Clock className="mx-auto h-12 w-12" />
                <h1 className="mt-3 font-display text-2xl font-semibold">One last step — save a card</h1>
                <p className="mt-1 text-sm text-white/85">
                  No deposit needed. Save a card (nothing is charged) to secure your slot with{" "}
                  {tech.businessName}.
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
            {groupServices.length > 1 ? (
              <div className="space-y-2">
                <p className="text-sm text-ink-faint">Your treatments</p>
                {groupServices.map(({ booking: b, service: s }) => (
                  <div key={b.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{s?.name ?? "Treatment"}</span>
                    <span className="text-ink-faint">{fmtTime(b.startIso)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <Row label="Service" value={service?.name ?? "Appointment"} />
            )}
            <Row label="When" value={fmtDateTime(booking.startIso)} />
            <Row label="With" value={tech.businessName} />
            <hr className="border-edge" />
            <Row label="Total" value={gbp(booking.pricePennies)} />
            {booking.cardPaymentMethodId ? (
              <Row label="Card saved (no deposit taken)" value="✓" />
            ) : (
              <Row label="Deposit paid" value={booking.depositStatus === "paid" ? gbp(booking.depositPennies) : "-"} />
            )}
            <Row label="Balance due on the day" value={gbp(booking.balancePennies)} strong />
            {(cancelled || booking.status === "cancelled") && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-300">
                <XCircle className="h-4 w-4" /> This booking has been cancelled.
              </div>
            )}
            {needsDeposit && !awaitingStripeReturn && isPaymentsReady(tech) && (
              <form action={payDepositAction}>
                <input type="hidden" name="handle" value={tech.handle} />
                <input type="hidden" name="token" value={booking.balanceToken} />
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white"
                  style={{ backgroundColor: brand }}
                >
                  <CreditCard className="h-4 w-4" /> Pay {gbp(booking.depositPennies)} deposit
                </button>
              </form>
            )}
            {needsCard && !awaitingStripeReturn && (
              <form action={saveCardAction}>
                <input type="hidden" name="handle" value={tech.handle} />
                <input type="hidden" name="token" value={booking.balanceToken} />
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white"
                  style={{ backgroundColor: brand }}
                >
                  <CreditCard className="h-4 w-4" /> Save card to secure booking
                </button>
                <p className="mt-2 text-center text-xs text-ink-faint">
                  Nothing is charged today.
                  {noShowFee > 0 && ` A no-show fee of up to ${gbp(noShowFee)} may apply if you miss the appointment.`}
                </p>
              </form>
            )}
            {booking.status !== "cancelled" && booking.balancePennies > 0 && booking.balanceStatus !== "paid" && !needsDeposit && !needsCard && (
              <Link href={`/pay/${booking.balanceToken}`} className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white" style={{ backgroundColor: brand }}>
                <CreditCard className="h-4 w-4" /> Pay balance now (optional)
              </Link>
            )}
            <Link href={`/api/bookings/${booking.balanceToken}/calendar`} className="flex w-full items-center justify-center gap-2 rounded-xl border border-edge py-3 text-sm font-medium text-ink-soft hover:bg-fill-hover">
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
                  {usesCardCapture(tech)
                    ? `Cancellations inside ${tech.cancellationWindowHours}h may charge your saved card.`
                    : `Cancellations inside ${tech.cancellationWindowHours}h may forfeit your deposit.`}
                </p>
              </form>
            )}
            <Link href={`/${tech.handle}`} className="flex w-full items-center justify-center gap-2 rounded-xl border border-edge py-3 text-sm font-medium text-ink-soft hover:bg-fill-hover">Back to {tech.businessName}</Link>
          </div>
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-ink-faint"><CalendarHeart className="h-3.5 w-3.5" /> Powered by Glow</p>
      </div>
    </div>
    </BookingThemedPage>
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
