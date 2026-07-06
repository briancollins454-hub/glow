"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/session";
import { isAdminTech } from "@/lib/admin";
import { supabaseService } from "@/lib/supabase/service";
import { createAuditEvent, updateTech } from "@/lib/db/queries";

async function adminCtx() {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  if (!isAdminTech(c!.tech)) notFound();
  return c!;
}

async function adminAudit(adminTechId: string, action: string, targetTechId: string) {
  try {
    await createAuditEvent(supabaseService(), {
      techId: adminTechId,
      actor: "tech",
      action,
      entityType: "tech",
      entityId: targetTechId,
      metadata: {},
    });
  } catch {
    // Audit is best-effort.
  }
}

/** Toggle the £1 tester offer on an account (fixes pre-fix signups too). */
export async function setTesterOfferAction(formData: FormData) {
  const { tech: admin } = await adminCtx();
  const id = String(formData.get("id") ?? "");
  const makeTester = formData.get("tester") === "1";
  await updateTech(supabaseService(), id, { signupOffer: makeTester ? "tester" : "" });
  await adminAudit(admin.id, makeTester ? "admin_marked_tester" : "admin_unmarked_tester", id);
  revalidatePath("/dashboard/admin");
  redirect("/dashboard/admin");
}

/** Give (or remove) complimentary access - e.g. friends & family accounts. */
export async function setCompAction(formData: FormData) {
  const { tech: admin } = await adminCtx();
  const id = String(formData.get("id") ?? "");
  const comp = formData.get("comp") === "1";
  await updateTech(supabaseService(), id, {
    subscriptionStatus: comp ? "comped" : "none",
  });
  await adminAudit(admin.id, comp ? "admin_comped_account" : "admin_uncomped_account", id);
  revalidatePath("/dashboard/admin");
  redirect("/dashboard/admin");
}
