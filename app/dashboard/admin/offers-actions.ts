"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/owner/require-owner";
import { ownerSb } from "@/lib/owner/require-owner";
import {
  isSignupOfferMode,
  setSignupOfferMode,
  type SignupOfferMode,
} from "@/lib/platform-settings";

/** Owner-only: switch platform signup offer mode. */
export async function setSignupOfferModeAction(formData: FormData) {
  const { tech } = await requireOwner();
  const confirm = String(formData.get("confirm") ?? "").trim().toLowerCase();
  if (confirm !== "yes") {
    redirect("/dashboard/admin/offers?err=confirm");
  }
  const modeRaw = String(formData.get("mode") ?? "");
  if (!isSignupOfferMode(modeRaw)) {
    redirect("/dashboard/admin/offers?err=mode");
  }
  const mode = modeRaw as SignupOfferMode;
  await setSignupOfferMode(ownerSb(), {
    mode,
    actorTechId: tech.id,
    actorEmail: tech.email,
  });
  revalidatePath("/dashboard/admin/offers");
  revalidatePath("/");
  revalidatePath("/pricing");
  revalidatePath("/signup");
  redirect(`/dashboard/admin/offers?ok=1&mode=${mode}`);
}
