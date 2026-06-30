"use server";

import { redirect } from "next/navigation";
import { getBookingByToken } from "@/lib/db/repo";
import { payBalance } from "@/lib/payments";
import { hydrate, flush } from "@/lib/db/store";

export async function payBalanceAction(formData: FormData) {
  await hydrate();
  const token = String(formData.get("token") ?? "");
  const booking = getBookingByToken(token);
  if (!booking) redirect("/");
  if (booking.balanceStatus !== "paid" && booking.balancePennies > 0) {
    await payBalance(booking.id);
  }
  await flush();
  redirect(`/pay/${token}?paid=1`);
}
