"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { requireOwner, requirePlatformOwner } from "@/lib/owner/require-owner";
import { ownerAudit } from "@/lib/owner/audit";
import { cachedInvalidate } from "@/lib/owner/cache";
import { updateTech, getTechById } from "@/lib/db/queries";
import { supabaseService } from "@/lib/supabase/service";
import { requestPasswordReset } from "@/lib/password-reset";
import { runRemindersJobNow } from "@/lib/owner/ops";

function confirm(formData: FormData, expected: string) {
  return String(formData.get("confirm") ?? "") === expected;
}

export async function ownerSetTesterAction(formData: FormData) {
  const { tech: admin } = await requireOwner();
  if (!confirm(formData, "yes")) {
    redirect("/dashboard/admin/accounts?err=confirm");
  }
  const id = String(formData.get("id") ?? "");
  const makeTester = formData.get("tester") === "1";
  const target = await getTechById(supabaseService(), id);
  if (!target) notFound();
  await updateTech(supabaseService(), id, { signupOffer: makeTester ? "tester" : "" });
  await ownerAudit({
    actorTechId: admin.id,
    action: makeTester ? "admin_marked_tester" : "admin_unmarked_tester",
    targetTechId: id,
    before: { signupOffer: target.signupOffer },
    after: { signupOffer: makeTester ? "tester" : "" },
  });
  cachedInvalidate("owner:");
  revalidatePath("/dashboard/admin");
  revalidatePath(`/dashboard/admin/accounts/${id}`);
  redirect(`/dashboard/admin/accounts/${id}?ok=tester`);
}

export async function ownerSetCompAction(formData: FormData) {
  const { tech: admin } = await requireOwner();
  if (!confirm(formData, "yes")) {
    redirect("/dashboard/admin/accounts?err=confirm");
  }
  const id = String(formData.get("id") ?? "");
  const comp = formData.get("comp") === "1";
  const target = await getTechById(supabaseService(), id);
  if (!target) notFound();
  const nextStatus = comp ? "comped" : "none";
  await updateTech(supabaseService(), id, { subscriptionStatus: nextStatus });
  await ownerAudit({
    actorTechId: admin.id,
    action: comp ? "admin_comped_account" : "admin_uncomped_account",
    targetTechId: id,
    before: { subscriptionStatus: target.subscriptionStatus },
    after: { subscriptionStatus: nextStatus },
  });
  cachedInvalidate("owner:");
  revalidatePath("/dashboard/admin");
  revalidatePath(`/dashboard/admin/accounts/${id}`);
  redirect(`/dashboard/admin/accounts/${id}?ok=comp`);
}

export async function ownerPasswordResetAction(formData: FormData) {
  const { tech: admin } = await requireOwner();
  if (!confirm(formData, "yes")) {
    redirect("/dashboard/admin/accounts?err=confirm");
  }
  const id = String(formData.get("id") ?? "");
  const target = await getTechById(supabaseService(), id);
  if (!target) notFound();
  await requestPasswordReset(target.email);
  await ownerAudit({
    actorTechId: admin.id,
    action: "admin_password_reset_email",
    targetTechId: id,
    metadata: { email: target.email },
  });
  redirect(`/dashboard/admin/accounts/${id}?ok=reset`);
}

export async function ownerRunCronAction(formData: FormData) {
  const { tech: admin } = await requireOwner();
  if (!confirm(formData, "yes")) {
    redirect("/dashboard/admin/ops?err=confirm");
  }
  const result = await runRemindersJobNow("manual");
  await ownerAudit({
    actorTechId: admin.id,
    action: "admin_cron_run_now",
    metadata: { result },
  });
  cachedInvalidate("owner:");
  revalidatePath("/dashboard/admin/ops");
  redirect(result.ok ? "/dashboard/admin/ops?ok=cron" : "/dashboard/admin/ops?err=cron");
}

export async function ownerFeedbackStatusAction(formData: FormData) {
  const { tech: admin } = await requireOwner();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["new", "reviewing", "done"].includes(status)) notFound();
  const sb = supabaseService();
  const { data: before } = await sb.from("feedback_submissions").select("*").eq("id", id).maybeSingle();
  await sb
    .from("feedback_submissions")
    .update({ status, updatedAt: new Date().toISOString() })
    .eq("id", id);
  await ownerAudit({
    actorTechId: admin.id,
    action: "admin_feedback_status",
    entityType: "feedback",
    entityId: id,
    before: before ? { status: before.status } : undefined,
    after: { status },
  });
  revalidatePath("/dashboard/admin/support");
  redirect("/dashboard/admin/support?ok=feedback");
}

export async function ownerCompleteClosureAction(formData: FormData) {
  const { tech: admin } = await requireOwner();
  if (!confirm(formData, "yes")) {
    redirect("/dashboard/admin/support?err=confirm");
  }
  const id = String(formData.get("id") ?? "");
  const sb = supabaseService();
  const { data: before } = await sb
    .from("account_closure_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!before) notFound();
  await sb
    .from("account_closure_requests")
    .update({ status: "completed", completedAt: new Date().toISOString() })
    .eq("id", id);
  await ownerAudit({
    actorTechId: admin.id,
    action: "admin_closure_completed",
    targetTechId: before.techId,
    entityType: "account_closure_request",
    entityId: id,
    before: { status: before.status },
    after: { status: "completed" },
  });
  revalidatePath("/dashboard/admin/support");
  redirect("/dashboard/admin/support?ok=closure");
}

export async function ownerRefreshCacheAction() {
  await requireOwner();
  cachedInvalidate("owner:");
  revalidatePath("/dashboard/admin");
  redirect("/dashboard/admin?ok=refresh");
}

export async function ownerCreatePartnerAction(formData: FormData) {
  const { tech: admin } = await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;
  if (!name || !slug) {
    redirect("/dashboard/admin/partners?err=slug");
  }
  try {
    const { createPartner } = await import("@/lib/partners");
    const partner = await createPartner({ name, slug, logoUrl });
    await ownerAudit({
      actorTechId: admin.id,
      action: "admin_partner_created",
      metadata: { partnerId: partner.id, slug: partner.slug },
    });
    revalidatePath("/dashboard/admin/partners");
    redirect("/dashboard/admin/partners?ok=1");
  } catch {
    redirect("/dashboard/admin/partners?err=save");
  }
}

/** Block an account (T&Cs / abuse). Exclusive to brian@thesupportsdesk.com. */
export async function ownerBlockAccountAction(formData: FormData) {
  const { tech: admin } = await requirePlatformOwner();
  if (!confirm(formData, "yes")) {
    redirect(`/dashboard/admin/accounts/${String(formData.get("id") ?? "")}?err=confirm`);
  }
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const sb = supabaseService();
  const target = await getTechById(sb, id);
  if (!target) notFound();
  if (target.id === admin.id) {
    redirect(`/dashboard/admin/accounts/${id}?err=self`);
  }
  try {
    const { blockTechAccount } = await import("@/lib/owner/account-moderation");
    await blockTechAccount(sb, {
      target,
      reason,
      actorEmail: admin.email,
    });
  } catch (err) {
    const msg = (err as Error).message || "block";
    redirect(
      `/dashboard/admin/accounts/${id}?err=${msg.includes("reason") ? "reason" : "block"}`,
    );
  }
  await ownerAudit({
    actorTechId: admin.id,
    action: "admin_blocked_account",
    targetTechId: id,
    before: { blockedAt: target.blockedAt ?? null },
    after: { blockedAt: "set", reason },
    metadata: { reason, email: target.email, handle: target.handle },
  });
  cachedInvalidate("owner:");
  revalidatePath("/dashboard/admin/accounts");
  revalidatePath(`/dashboard/admin/accounts/${id}`);
  redirect(`/dashboard/admin/accounts/${id}?ok=blocked`);
}

/** Unblock a previously blocked account. Exclusive to brian@thesupportsdesk.com. */
export async function ownerUnblockAccountAction(formData: FormData) {
  const { tech: admin } = await requirePlatformOwner();
  if (!confirm(formData, "yes")) {
    redirect(`/dashboard/admin/accounts/${String(formData.get("id") ?? "")}?err=confirm`);
  }
  const id = String(formData.get("id") ?? "");
  const sb = supabaseService();
  const target = await getTechById(sb, id);
  if (!target) notFound();
  const { unblockTechAccount } = await import("@/lib/owner/account-moderation");
  await unblockTechAccount(sb, { target });
  await ownerAudit({
    actorTechId: admin.id,
    action: "admin_unblocked_account",
    targetTechId: id,
    before: {
      blockedAt: target.blockedAt ?? null,
      blockedReason: target.blockedReason ?? "",
    },
    after: { blockedAt: null },
    metadata: { email: target.email, handle: target.handle },
  });
  cachedInvalidate("owner:");
  revalidatePath("/dashboard/admin/accounts");
  revalidatePath(`/dashboard/admin/accounts/${id}`);
  redirect(`/dashboard/admin/accounts/${id}?ok=unblocked`);
}

/**
 * Permanently delete an account. Confirm by typing the handle.
 * Exclusive to brian@thesupportsdesk.com.
 */
export async function ownerDeleteAccountAction(formData: FormData) {
  const { tech: admin } = await requirePlatformOwner();
  const id = String(formData.get("id") ?? "");
  const sb = supabaseService();
  const target = await getTechById(sb, id);
  if (!target) notFound();
  if (target.id === admin.id) {
    redirect(`/dashboard/admin/accounts/${id}?err=self`);
  }
  const typed = String(formData.get("confirm") ?? "").trim().toLowerCase();
  if (typed !== target.handle.trim().toLowerCase()) {
    redirect(`/dashboard/admin/accounts/${id}?err=confirm_handle`);
  }
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  const snapshot = {
    email: target.email,
    handle: target.handle,
    businessName: target.businessName,
    stripeCustomerId: target.stripeCustomerId,
    stripeSubscriptionId: target.stripeSubscriptionId,
    reason,
  };
  // Audit before delete so the trail survives even if target techId rows go.
  await ownerAudit({
    actorTechId: admin.id,
    action: "admin_deleted_account",
    targetTechId: id,
    metadata: snapshot,
  });
  try {
    const { deleteTechAccount } = await import("@/lib/owner/account-moderation");
    await deleteTechAccount(sb, { target, actorEmail: admin.email });
  } catch (err) {
    console.error("[owner delete]", (err as Error).message);
    redirect(`/dashboard/admin/accounts/${id}?err=delete`);
  }
  cachedInvalidate("owner:");
  revalidatePath("/dashboard/admin/accounts");
  redirect("/dashboard/admin/accounts?ok=deleted");
}
