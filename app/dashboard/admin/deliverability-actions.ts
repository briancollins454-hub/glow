"use server";

import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/owner/require-owner";
import { ownerSb } from "@/lib/owner/require-owner";
import { writeOwnerAudit } from "@/lib/owner/owner-audit-log";
import { updateTech } from "@/lib/db/queries";
import { assertNotViewAs } from "@/lib/owner/view-as";

function confirm(formData: FormData) {
  return String(formData.get("confirm") ?? "") === "yes";
}

export async function unsuppressEmailAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  if (!confirm(formData)) redirect("/dashboard/admin/deliverability?err=confirm");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!email || !reason) redirect("/dashboard/admin/deliverability?err=reason");
  const sb = ownerSb();
  await sb
    .from("email_suppressions")
    .update({
      suppressed: false,
      reason: null,
      consecutiveSoftFailures: 0,
      updatedAt: new Date().toISOString(),
    })
    .eq("email", email);
  await writeOwnerAudit({
    actorEmail: admin.email,
    action: "unsuppress_email",
    targetType: "email",
    targetId: email,
    metadata: { reason },
  });
  redirect("/dashboard/admin/deliverability?ok=unsuppress");
}

export async function clearTechDeliveryFlagAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  if (!confirm(formData)) redirect("/dashboard/admin/deliverability?err=confirm");
  const id = String(formData.get("id") ?? "");
  await updateTech(ownerSb(), id, {
    emailDeliveryIssue: false,
    emailDeliveryIssueReason: null,
    emailDeliveryIssueAt: null,
  });
  await writeOwnerAudit({
    actorEmail: admin.email,
    action: "clear_delivery_flag",
    targetType: "tech",
    targetId: id,
  });
  redirect("/dashboard/admin/deliverability?ok=flag");
}
