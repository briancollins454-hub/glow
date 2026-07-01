import type { SupabaseClient } from "@supabase/supabase-js";
import { createPayment, getBooking, updateBooking } from "@/lib/db/queries";
import type { PaymentKind } from "@/lib/db/types";

// Stubbed payment provider. Swap this module for Stripe Connect in Phase D.
export interface ChargeResult {
  ok: boolean;
  providerRef: string;
  provider: string;
}

const PROVIDER = process.env.PAYMENTS_PROVIDER ?? "stub";

export async function charge(
  sb: SupabaseClient,
  params: { techId: string; bookingId: string; kind: PaymentKind; amountPennies: number },
): Promise<ChargeResult> {
  const providerRef = `${PROVIDER}_${Math.random().toString(36).slice(2, 12)}`;
  await createPayment(sb, {
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

export async function payBalance(sb: SupabaseClient, bookingId: string): Promise<ChargeResult> {
  const booking = await getBooking(sb, bookingId);
  if (!booking) return { ok: false, providerRef: "", provider: PROVIDER };
  const result = await charge(sb, {
    techId: booking.techId,
    bookingId: booking.id,
    kind: "balance",
    amountPennies: booking.balancePennies,
  });
  if (result.ok) await updateBooking(sb, booking.id, { balanceStatus: "paid" });
  return result;
}
