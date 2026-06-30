import { createPayment, getBooking, updateBooking } from "@/lib/db/repo";
import type { PaymentKind } from "@/lib/db/types";

// Stubbed payment provider. Swap this module for Stripe Connect in Phase D.
// The rest of the app only depends on this interface, never on Stripe directly.

export interface ChargeResult {
  ok: boolean;
  providerRef: string;
  provider: string;
}

const PROVIDER = process.env.PAYMENTS_PROVIDER ?? "stub";

export async function charge(params: {
  techId: string;
  bookingId: string;
  kind: PaymentKind;
  amountPennies: number;
}): Promise<ChargeResult> {
  // Stub: always succeeds instantly. A real impl would create a Stripe
  // PaymentIntent on the connected account and confirm it.
  const providerRef = `${PROVIDER}_${Math.random().toString(36).slice(2, 12)}`;

  createPayment({
    techId: params.techId,
    bookingId: params.bookingId,
    kind: params.kind,
    amountPennies: params.amountPennies,
    status: "succeeded",
    provider: PROVIDER,
    providerRef,
  });

  return { ok: true, providerRef, provider: PROVIDER };
}

/** Pay the remaining balance for a booking (used by the tokenised link). */
export async function payBalance(bookingId: string): Promise<ChargeResult> {
  const booking = getBooking(bookingId);
  if (!booking) return { ok: false, providerRef: "", provider: PROVIDER };
  const result = await charge({
    techId: booking.techId,
    bookingId: booking.id,
    kind: "balance",
    amountPennies: booking.balancePennies,
  });
  if (result.ok) {
    updateBooking(booking.id, { balanceStatus: "paid" });
  }
  return result;
}
