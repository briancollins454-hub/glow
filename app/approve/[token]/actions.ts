"use server";

import { redirect } from "next/navigation";
import { supabaseService } from "@/lib/supabase/service";
import { getBookingByApprovalToken } from "@/lib/db/queries";
import { approveBookingRequest, declineBookingRequest } from "@/lib/bookings";
import { rateLimit } from "@/lib/rate-limit";

export async function approveBookingFromEmailAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!(await rateLimit("token-lookup", { limit: 30, windowMs: 60_000 })).ok) {
    redirect(`/approve/${token}?err=rate`);
  }
  const sb = supabaseService();
  const booking = await getBookingByApprovalToken(sb, token);
  if (!booking) redirect("/");
  await approveBookingRequest(sb, booking);
  redirect(`/approve/${token}?done=approved&bid=${booking.id}`);
}

export async function declineBookingFromEmailAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!(await rateLimit("token-lookup", { limit: 30, windowMs: 60_000 })).ok) {
    redirect(`/approve/${token}?err=rate`);
  }
  const sb = supabaseService();
  const booking = await getBookingByApprovalToken(sb, token);
  if (!booking) redirect("/");
  await declineBookingRequest(sb, booking);
  redirect(`/approve/${token}?done=declined&bid=${booking.id}`);
}
