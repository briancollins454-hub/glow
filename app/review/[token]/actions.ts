"use server";

import { redirect } from "next/navigation";
import { supabaseService } from "@/lib/supabase/service";
import { createAuditEvent, createReview, getBookingByToken, getReviewByBookingId } from "@/lib/db/queries";
import { rateLimit } from "@/lib/rate-limit";

export async function submitReviewAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!(await rateLimit("token-lookup", { limit: 30, windowMs: 60_000 })).ok) {
    redirect(`/review/${token}?err=rate`);
  }
  const rating = Math.min(5, Math.max(1, parseInt(String(formData.get("rating") ?? "0"), 10) || 0));
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 1000);

  const sb = supabaseService();
  const booking = await getBookingByToken(sb, token);
  if (!booking) redirect("/");
  if (!rating) redirect(`/review/${token}?err=rating`);

  const existing = await getReviewByBookingId(sb, booking!.id);
  if (!existing) {
    await createReview(sb, {
      techId: booking!.techId,
      clientId: booking!.clientId,
      bookingId: booking!.id,
      rating,
      comment,
      status: "pending",
    });
    try {
      await createAuditEvent(sb, {
        techId: booking!.techId,
        actor: "client",
        action: "review_submitted",
        entityType: "booking",
        entityId: booking!.id,
        metadata: { rating },
      });
    } catch {
      // Audit is best-effort.
    }
  }
  redirect(`/review/${token}?done=1`);
}
