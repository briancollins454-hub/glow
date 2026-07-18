"use server";

import { redirect } from "next/navigation";
import { supabaseService } from "@/lib/supabase/service";
import {
  createAuditEvent,
  createPayment,
  getBookingByToken,
  getService,
  getTechByHandle,
  listBookingsByGroup,
  paymentsForBooking,
  skipScheduledReminders,
  updateBooking,
} from "@/lib/db/queries";
import { syncBookingToGoogle } from "@/lib/google-calendar";
import { createDepositCheckout, refundOnConnect } from "@/lib/payments";
import { isPaymentsReady } from "@/lib/subscriptions";
import type { Booking } from "@/lib/db/types";

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

  const patch: Partial<typeof booking> = { status: "cancelled" };
  const hoursOut = (new Date(booking.startIso).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursOut < tech.cancellationWindowHours) {
    if (booking.depositStatus === "paid") patch.depositStatus = "forfeited";
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
  try {
    await syncBookingToGoogle(sb, tech, { ...booking, ...patch });
  } catch {
    // Google Calendar sync is best-effort.
  }
  try {
    const { notifyWaitlistForCancelledBooking } = await import("@/lib/waitlist");
    await notifyWaitlistForCancelledBooking(sb, { ...booking, ...patch });
  } catch {
    // Waitlist notifications are best-effort.
  }
  await skipScheduledReminders(sb, booking.id);
  try {
    await createAuditEvent(sb, {
      techId: tech.id,
      actor: "client",
      action: "booking_cancelled_self_service",
      entityType: "booking",
      entityId: booking.id,
      metadata: { hoursOut, depositStatus: patch.depositStatus, balanceStatus: patch.balanceStatus },
    });
  } catch {
    // Do not block cancellation if audit tables are not deployed yet.
  }
  redirect(`/${handle}/booked/${token}?cancelled=1`);
}
