"use server";

import { redirect } from "next/navigation";
import { supabaseService } from "@/lib/supabase/service";
import { getBookingByApprovalToken } from "@/lib/db/queries";
import { approveBookingRequest, declineBookingRequest } from "@/lib/bookings";

export async function approveBookingFromEmailAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const sb = supabaseService();
  const booking = await getBookingByApprovalToken(sb, token);
  if (!booking) redirect("/");
  await approveBookingRequest(sb, booking);
  redirect(`/approve/${token}?done=approved`);
}

export async function declineBookingFromEmailAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const sb = supabaseService();
  const booking = await getBookingByApprovalToken(sb, token);
  if (!booking) redirect("/");
  await declineBookingRequest(sb, booking);
  redirect(`/approve/${token}?done=declined`);
}
