"use server";

import { redirect } from "next/navigation";
import { supabaseService } from "@/lib/supabase/service";
import {
  createAuditEvent,
  getBookingByToken,
  getTechByHandle,
  paymentsForBooking,
  skipScheduledReminders,
  updateBooking,
} from "@/lib/db/queries";
import { syncBookingToGoogle } from "@/lib/google-calendar";
import { refundOnConnect } from "@/lib/payments";

export async function cancelClientBookingAction(formData: FormData) {
  const handle = String(formData.get("handle") ?? "");
  const token = String(formData.get("token") ?? "");
  const sb = supabaseService();
  const [tech, booking] = await Promise.all([
    getTechByHandle(sb, handle),
    getBookingByToken(sb, token),
  ]);
  if (!tech || !booking || booking.techId !== tech.id) redirect(`/${handle}`);
  if (booking.status === "cancelled" || booking.status === "completed" || booking.status === "no_show") {
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
        if (p.kind === "deposit") patch.depositStatus = "refunded";
        if (p.kind === "balance") patch.balanceStatus = "refunded";
      } catch {
        // Leave payment state as-is; the tech can complete the refund in Stripe.
      }
    }
  }

  await updateBooking(sb, booking.id, patch);
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
