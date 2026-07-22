import { redirect } from "next/navigation";
import { supabaseService } from "@/lib/supabase/service";
import { getBookingByToken, getTechByHandle } from "@/lib/db/queries";
import { releaseAbandonedCheckoutBooking } from "@/lib/bookings";

export const metadata = { robots: { index: false, follow: false } };

/**
 * Stripe Checkout cancel_url landing: free the pending hold if checkout never
 * completed, then send the client back to the public booking page.
 */
export default async function CheckoutCancelPage({
  params,
}: {
  params: Promise<{ handle: string; token: string }>;
}) {
  const { handle, token } = await params;
  const sb = supabaseService();
  const [tech, booking] = await Promise.all([
    getTechByHandle(sb, handle),
    getBookingByToken(sb, token),
  ]);

  if (!tech || !booking || booking.techId !== tech.id) {
    redirect(`/${handle}?err=payment_cancelled`);
  }

  // Idempotent: no-op if the webhook already confirmed (or already cancelled).
  await releaseAbandonedCheckoutBooking(sb, booking);

  redirect(`/${tech.handle}?service=${booking.serviceId}&err=payment_cancelled`);
}
