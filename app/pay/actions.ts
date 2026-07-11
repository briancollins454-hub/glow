"use server";

import { redirect } from "next/navigation";
import { supabaseService } from "@/lib/supabase/service";
import { getBookingByToken, getService, getTechById } from "@/lib/db/queries";
import { createBalanceCheckout } from "@/lib/payments";
import { rateLimit } from "@/lib/rate-limit";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function payBalanceAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!(await rateLimit("token-lookup", { limit: 30, windowMs: 60_000 })).ok) {
    redirect(`/pay/${token}?err=rate`);
  }
  const sb = supabaseService();
  const booking = await getBookingByToken(sb, token);
  if (!booking) redirect("/");
  if (booking.balanceStatus === "paid" || booking.balancePennies <= 0) {
    redirect(`/pay/${token}?paid=1`);
  }
  const [tech, service] = await Promise.all([
    getTechById(sb, booking.techId),
    getService(sb, booking.serviceId),
  ]);
  if (!tech || !service || !tech.stripeConnectAccountId) {
    redirect(`/pay/${token}?err=unavailable`);
  }
  const url = await createBalanceCheckout(tech!, service!, booking, APP_URL);
  redirect(url);
}
