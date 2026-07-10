"use server";

import { redirect } from "next/navigation";
import { supabaseService } from "@/lib/supabase/service";
import { submitReactionCheckinResponse } from "@/lib/reaction-checkin";

export async function submitCheckinAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const response = String(formData.get("response") ?? "") as "fine" | "reaction";
  const symptoms = String(formData.get("symptoms") ?? "").trim();

  if (!token || (response !== "fine" && response !== "reaction")) {
    redirect(`/checkin/${token}?err=invalid`);
  }
  if (response === "reaction" && !symptoms) {
    redirect(`/checkin/${token}?err=symptoms`);
  }

  const sb = supabaseService();
  const result = await submitReactionCheckinResponse(sb, token, response, symptoms);
  if (!result.ok) {
    redirect(`/checkin/${token}?err=${result.error ?? "failed"}`);
  }
  redirect(`/checkin/${token}?done=1`);
}
