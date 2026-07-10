"use server";

import { redirect } from "next/navigation";
import { supabaseService } from "@/lib/supabase/service";
import { submitPreCareConfirmation } from "@/lib/pre-care";

export async function submitPrecareAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!token) redirect("/");

  const sb = supabaseService();
  const result = await submitPreCareConfirmation(sb, token);
  if (!result.ok) {
    redirect(`/precare/${token}?err=${result.error ?? "failed"}`);
  }
  redirect(`/precare/${token}?done=1`);
}
