"use server";

import { redirect } from "next/navigation";
import { completePasswordReset } from "@/lib/password-reset";

export async function resetPasswordAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) redirect(`/reset/${token}?error=short`);
  if (password !== confirm) redirect(`/reset/${token}?error=match`);

  const ok = await completePasswordReset(token, password);
  if (!ok) redirect(`/reset/${token}?error=failed`);
  redirect("/login?reset=1");
}
