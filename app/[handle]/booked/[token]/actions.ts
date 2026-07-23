"use server";

import { redirect } from "next/navigation";
import { supabaseService } from "@/lib/supabase/service";
import {
  createAuditEvent,
  createPayment,
  getBookingByToken,
  getClient,
  getService,
  getTechByHandle,
  listBookingsByGroup,
  paymentsForBooking,
  skipScheduledReminders,
  updateBooking,
} from "@/lib/db/queries";
import { syncBookingToGoogle } from "@/lib/google-calendar";
import { createCardCaptureCheckout, createDepositCheckout, refundOnConnect } from "@/lib/payments";
import { isPaymentsReady, usesCardCapture } from "@/lib/subscriptions";
import type { Booking } from "@/lib/db/types";
import type { CardProtectionCharge } from "@/lib/card-protection";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Basket groups keep all money on the primary (earliest) booking. */
async function resolvePrimary(
  sb: ReturnType<typeof supabaseService>,
  booking: Booking,
): Promise<{ primary: Booking; group: Booking[] }> {
  if (!booking.groupId) return { primary: booking, group: [booking] };
  const group = await listBookingsByGroup(sb, booking.groupId);
  return { primary: group[0] ?? booking, group: group.length ? group : [booking] };
}

export async function payDepositAction(formData: FormData) {
  const handle = String(formData.get("handle") ?? "");
  const token = String(formData.get("token") ?? "");
  const sb = supabaseService();
  const [tech, tokenBooking] = await Promise.all([
    getTechByHandle(sb, handle),
    getBookingByToken(sb, token),
  ]);
  if (!tech || !tokenBooking || tokenBooking.techId !== tech.id) redirect(`/${handle}`);
  const { primary: booking, group } = await resolvePrimary(sb, tokenBooking!);
  if (booking.status !== "pending" || booking.depositStatus === "paid" || booking.depositPennies <= 0) {
    redirect(`/${handle}/booked/${token}`);
  }
  if (!isPaymentsReady(tech)) redirect(`/${handle}/booked/${token}`);
  const service = await getService(sb, booking.serviceId);
  if (!service) redirect(`/${handle}/booked/${token}`);
  const checkoutService =
    group.length > 1
      ? { ...service, name: `${service.name} + ${group.length - 1} more treatment${group.length > 2 ? "s" : ""}` }
      : service;
  const url = await createDepositCheckout(tech, checkoutService, booking, APP_URL);
  redirect(url);
}

/** Card capture mode: save a card to secure a pending booking (e.g. after approval). */
export async function saveCardAction(formData: FormData) {
  const handle = String(formData.get("handle") ?? "");
  const token = String(formData.get("token") ?? "");
  const sb = supabaseService();
  const [tech, tokenBooking] = await Promise.all([
    getTechByHandle(sb, handle),
    getBookingByToken(sb, token),
  ]);
  if (!tech || !tokenBooking || tokenBooking.techId !== tech.id) redirect(`/${handle}`);
  const { primary: booking, group } = await resolvePrimary(sb, tokenBooking!);
  if (booking.status !== "pending" || booking.cardPaymentMethodId || !usesCardCapture(tech)) {
    redirect(`/${handle}/booked/${token}`);
  }
  const service = await getService(sb, booking.serviceId);
  if (!service) redirect(`/${handle}/booked/${token}`);
  const checkoutService =
    group.length > 1
      ? { ...service, name: `${service.name} + ${group.length - 1} more treatment${group.length > 2 ? "s" : ""}` }
      : service;
  const client = await getClient(sb, booking.clientId);
  const url = await createCardCaptureCheckout(
    tech,
    checkoutService,
    booking,
    { name: client?.name ?? "", email: client?.email ?? "" },
    APP_URL,
  );
  redirect(url);
}

export async function cancelClientBookingAction(formData: FormData) {
  const handle = String(formData.get("handle") ?? "");
  const token = String(formData.get("token") ?? "");
  const sb = supabaseService();
  const [tech, tokenBooking] = await Promise.all([
    getTechByHandle(sb, handle),
    getBookingByToken(sb, token),
  ]);
  if (!tech || !tokenBooking || tokenBooking.techId !== tech.id) redirect(`/${handle}`);
  // Basket visits cancel as one: money lives on the primary booking and the
  // treatments are back-to-back, so partial self-service cancellation is out.
  const { primary: booking, group } = await resolvePrimary(sb, tokenBooking!);
  if (
    booking.status === "cancelled" ||
    booking.status === "completed" ||
    booking.status === "no_show"
  ) {
    redirect(`/${handle}/booked/${token}?cancelled=1`);
  }

  const priorStatus = booking.status;
  const patch: Partial<typeof booking> = { status: "cancelled" };
  const hoursOut = (new Date(booking.startIso).getTime() - Date.now()) / (1000 * 60 * 60);
  let cardCharge: CardProtectionCharge | null = null;
  if (hoursOut < tech.cancellationWindowHours) {
    if (booking.depositStatus === "paid") patch.depositStatus = "forfeited";
    // Card capture: charge the protection fee on late self-cancel.
    const { chargeCardProtectionFee } = await import("@/lib/card-protection");
    cardCharge = await chargeCardProtectionFee(sb, tech, booking, "late_cancel");
  } else if (tech.stripeConnectAccountId) {
    const payments = await paymentsForBooking(sb, booking.id);
    for (const p of payments) {
      if (p.status !== "succeeded" || !p.providerRef) continue;
      if (p.kind !== "deposit" && p.kind !== "balance") continue;
      try {
        await refundOnConnect(tech, p.providerRef);
        await createPayment(sb, {
          techId: tech.id,
          bookingId: booking.id,
          kind: "refund",
          amountPennies: p.amountPennies,
          status: "succeeded",
          provider: "stripe",
          providerRef: p.providerRef,
        });
        if (p.kind === "deposit") patch.depositStatus = "refunded";
        if (p.kind === "balance") patch.balanceStatus = "refunded";
      } catch {
        // Leave payment state as-is; the tech can complete the refund in Stripe.
      }
    }
  }

  await updateBooking(sb, booking.id, patch);
  const cancelledBooking = { ...booking, ...patch };
  // Cancel the rest of the visit (secondary bookings hold no money).
  for (const b of group) {
    if (b.id === booking.id) continue;
    if (b.status === "cancelled" || b.status === "completed" || b.status === "no_show") continue;
    await updateBooking(sb, b.id, { status: "cancelled" });
    await skipScheduledReminders(sb, b.id);
    try {
      await syncBookingToGoogle(sb, tech, { ...b, status: "cancelled" });
    } catch {
      // Google Calendar sync is best-effort.
    }
  }
  const { revalidatePublicAvailability } = await import("@/lib/booking/public-availability-cache");
  revalidatePublicAvailability(tech.id);
  try {
    await syncBookingToGoogle(sb, tech, cancelledBooking);
  } catch {
    // Google Calendar sync is best-effort.
  }
  try {
    const { notifyWaitlistForCancelledBooking } = await import("@/lib/waitlist");
    await notifyWaitlistForCancelledBooking(sb, cancelledBooking);
  } catch {
    // Waitlist notifications are best-effort.
  }
  await skipScheduledReminders(sb, booking.id);

  // Salon email: only for real held bookings (not unpaid pending holds).
  const shouldNotifySalon =
    priorStatus === "confirmed" ||
    booking.depositStatus === "paid" ||
    !!booking.cardPaymentMethodId;
  if (shouldNotifySalon) {
    try {
      const { notifySalonOfCancellation, cancellationAdvanceLabel, cancellationMoneyStatus } =
        await import("@/lib/notify");
      await notifySalonOfCancellation(sb, cancelledBooking, {
        hoursOut,
        cardCharge: cardCharge
          ? { outcome: cardCharge.outcome, amountPennies: cardCharge.amountPennies }
          : null,
      });
      const client = await getClient(sb, booking.clientId);
      const service = await getService(sb, booking.serviceId);
      await createAuditEvent(sb, {
        techId: tech.id,
        actor: "client",
        action: "booking_cancelled_self_service",
        entityType: "booking",
        entityId: booking.id,
        metadata: {
          hoursOut,
          depositStatus: patch.depositStatus ?? booking.depositStatus,
          balanceStatus: patch.balanceStatus ?? booking.balanceStatus,
          clientName: client?.name ?? "",
          serviceName: service?.name ?? "",
          startIso: booking.startIso,
          advanceLabel: cancellationAdvanceLabel(hoursOut),
          moneyStatus: cancellationMoneyStatus({
            depositPennies: cancelledBooking.depositPennies,
            depositStatus: cancelledBooking.depositStatus,
            balanceStatus: cancelledBooking.balanceStatus,
            cardPaymentMethodId: cancelledBooking.cardPaymentMethodId,
            cardCharge: cardCharge
              ? { outcome: cardCharge.outcome, amountPennies: cardCharge.amountPennies }
              : null,
          }),
        },
      });
    } catch {
      // Do not block cancellation if notify/audit fail.
    }
  }
  redirect(`/${handle}/booked/${token}?cancelled=1`);
}
