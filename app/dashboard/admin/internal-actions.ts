"use server";

import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/owner/require-owner";
import { ownerSb } from "@/lib/owner/require-owner";
import { updateTech, getTechById } from "@/lib/db/queries";
import { setIncludeInternal } from "@/lib/owner/internal-accounts";
import { writeOwnerAudit } from "@/lib/owner/owner-audit-log";
import { cachedInvalidate } from "@/lib/owner/cache";
import { revalidatePath } from "next/cache";
import { assertNotViewAs } from "@/lib/owner/view-as";
import { isConfirmed } from "@/lib/owner/confirm";

export async function setInternalFlagAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  if (!isConfirmed(formData)) redirect("/dashboard/admin/internal?err=confirm");
  const id = String(formData.get("id") ?? "");
  const makeInternal = formData.get("internal") === "1";
  const target = await getTechById(ownerSb(), id);
  if (!target) redirect("/dashboard/admin/internal");
  await updateTech(ownerSb(), id, { isInternal: makeInternal });
  await writeOwnerAudit({
    actorEmail: admin.email,
    action: makeInternal ? "mark_internal" : "unmark_internal",
    targetType: "tech",
    targetId: id,
    metadata: { handle: target.handle },
  });
  cachedInvalidate("owner:");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/admin/internal");
  redirect(`/dashboard/admin/internal?ok=${makeInternal ? "marked" : "unmarked"}`);
}

export async function setIncludeInternalToggleAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  if (!isConfirmed(formData)) redirect("/dashboard/admin/internal?err=confirm");
  const enabled = formData.get("enabled") === "1";
  await setIncludeInternal(ownerSb(), enabled, admin.email);
  await writeOwnerAudit({
    actorEmail: admin.email,
    action: "toggle_include_internal_metrics",
    metadata: { enabled },
  });
  cachedInvalidate("owner:");
  revalidatePath("/dashboard/admin");
  redirect("/dashboard/admin/internal?ok=toggle");
}
