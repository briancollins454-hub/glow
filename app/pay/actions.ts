"use server";

import { redirect } from "next/navigation";
import { supabaseService } from "@/lib/supabase/service";
import { getBookingByToken } from "@/lib/db/queries";
import { payBalance } from "@/lib/payments";

export async function payBalanceAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const sb = supabaseService();
  const booking = await getBookingByToken(sb, token);
  if (!booking) redirect("/");
  if (booking.balanceStatus !== "paid" && booking.balancePennies > 0) {
    await payBalance(sb, booking.id);
  }
  redirect(`/pay/${token}?paid=1`);
}
