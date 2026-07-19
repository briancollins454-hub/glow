import type { SupabaseClient } from "@supabase/supabase-js";
import type { Booking, Tech } from "@/lib/db/types";
import { noShowFeeFor } from "@/lib/rules";
import { chargeNoShowFee, type CardProtectionReason } from "@/lib/payments";
import { createPayment, createAuditEvent } from "@/lib/db/queries";

export type CardProtectionCharge =
  | { outcome: "charged"; amountPennies: number; paymentIntentId: string }
  | { outcome: "declined"; amountPennies: number; error: string }
  | { outcome: "skipped"; amountPennies: number; reason: string };

/**
 * Charge the configured no-show / late-cancel fee against a booking's saved
 * card. Records a payment + audit on success; never throws for bank declines.
 */
export async function chargeCardProtectionFee(
  sb: SupabaseClient,
  tech: Tech,
  booking: Pick<Booking, "id" | "techId" | "pricePennies" | "cardCustomerId" | "cardPaymentMethodId">,
  reason: CardProtectionReason,
): Promise<CardProtectionCharge> {
  if (!booking.cardPaymentMethodId || !tech.stripeConnectAccountId) {
    return { outcome: "skipped", amountPennies: 0, reason: "no_saved_card" };
  }
  const fee = noShowFeeFor(tech, booking.pricePennies);
  if (fee <= 0) return { outcome: "skipped", amountPennies: 0, reason: "zero_fee" };

  const result = await chargeNoShowFee(tech, booking, fee, { reason });
  const actionOk = reason === "late_cancel" ? "late_cancel_fee_charged" : "no_show_fee_charged";
  const actionFail = reason === "late_cancel" ? "late_cancel_fee_failed" : "no_show_fee_failed";

  if (result.ok) {
    await createPayment(sb, {
      techId: tech.id,
      bookingId: booking.id,
      kind: "no_show_fee",
      amountPennies: fee,
      status: "succeeded",
      provider: "stripe",
      providerRef: result.paymentIntentId,
    }).catch(() => {});
    await createAuditEvent(sb, {
      techId: tech.id,
      actor: "tech",
      action: actionOk,
      entityType: "booking",
      entityId: booking.id,
      metadata: { amountPennies: fee, paymentIntentId: result.paymentIntentId, reason },
    }).catch(() => {});
    return { outcome: "charged", amountPennies: fee, paymentIntentId: result.paymentIntentId };
  }

  await createAuditEvent(sb, {
    techId: tech.id,
    actor: "tech",
    action: actionFail,
    entityType: "booking",
    entityId: booking.id,
    metadata: { amountPennies: fee, error: result.error ?? "", reason },
  }).catch(() => {});
  return { outcome: "declined", amountPennies: fee, error: result.error ?? "Charge failed" };
}
