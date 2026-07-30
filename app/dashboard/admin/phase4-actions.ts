"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner, ownerSb } from "@/lib/owner/require-owner";
import { assertNotViewAs } from "@/lib/owner/view-as";
import { writeOwnerAudit } from "@/lib/owner/owner-audit-log";
import { updateTech, getTechById } from "@/lib/db/queries";
import { randomId } from "@/lib/ids";
import { saveView, deleteSavedView, type AccountFilters } from "@/lib/owner/saved-views";
import {
  assertNotBulkDelete,
  createBroadcastPreview,
  sendBroadcast,
  type BroadcastFilter,
} from "@/lib/owner/broadcast";
import { sendEmail } from "@/lib/email";
import { sendOwnerWeeklyDigest } from "@/lib/owner/digest";

function confirm(formData: FormData) {
  return String(formData.get("confirm") ?? "") === "yes";
}

function idsFromForm(formData: FormData): string[] {
  const raw = formData.getAll("ids");
  const ids = raw.map(String).filter(Boolean);
  // Cap bulk size for safety / idempotency
  return [...new Set(ids)].slice(0, 50);
}

export async function addOwnerNoteAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  const id = String(formData.get("id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!id || !body) redirect(`/dashboard/admin/accounts/${id}?err=note`);
  await ownerSb().from("owner_notes").insert({
    id: randomId("onote"),
    techId: id,
    body: body.slice(0, 4000),
    authorEmail: admin.email,
    createdAt: new Date().toISOString(),
  });
  await writeOwnerAudit({
    actorEmail: admin.email,
    action: "owner_note_added",
    targetType: "tech",
    targetId: id,
  });
  revalidatePath(`/dashboard/admin/accounts/${id}`);
  redirect(`/dashboard/admin/accounts/${id}?ok=note`);
}

export async function bulkOwnerAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  if (!confirm(formData)) redirect("/dashboard/admin/accounts?err=confirm");
  const action = String(formData.get("bulkAction") ?? "");
  assertNotBulkDelete(action);
  const ids = idsFromForm(formData);
  if (!ids.length) redirect("/dashboard/admin/accounts?err=ids");

  if (action === "mark_internal") {
    for (const id of ids) {
      await updateTech(ownerSb(), id, { isInternal: true });
      await writeOwnerAudit({
        actorEmail: admin.email,
        action: "bulk_mark_internal",
        targetType: "tech",
        targetId: id,
      });
    }
  } else if (action === "mark_at_risk") {
    for (const id of ids) {
      await updateTech(ownerSb(), id, { atRiskManual: true });
      await writeOwnerAudit({
        actorEmail: admin.email,
        action: "bulk_mark_at_risk",
        targetType: "tech",
        targetId: id,
      });
    }
  } else if (action === "add_tag") {
    const tag = String(formData.get("tag") ?? "").trim().toLowerCase();
    if (!tag) redirect("/dashboard/admin/accounts?err=tag");
    for (const id of ids) {
      const tech = await getTechById(ownerSb(), id);
      if (!tech) continue;
      const tags = [...new Set([...(tech.ownerTags ?? []), tag])];
      await updateTech(ownerSb(), id, { ownerTags: tags });
      await writeOwnerAudit({
        actorEmail: admin.email,
        action: "bulk_add_tag",
        targetType: "tech",
        targetId: id,
        metadata: { tag },
      });
    }
  } else if (action === "add_note") {
    const body = String(formData.get("note") ?? "").trim();
    if (!body) redirect("/dashboard/admin/accounts?err=note");
    for (const id of ids) {
      await ownerSb().from("owner_notes").insert({
        id: randomId("onote"),
        techId: id,
        body: body.slice(0, 4000),
        authorEmail: admin.email,
        createdAt: new Date().toISOString(),
      });
    }
    await writeOwnerAudit({
      actorEmail: admin.email,
      action: "bulk_add_note",
      metadata: { count: ids.length },
    });
  } else if (action === "nudge") {
    const kind = String(formData.get("kind") ?? "setup_help");
    for (const id of ids) {
      const target = await getTechById(ownerSb(), id);
      if (!target?.email) continue;
      const text =
        `Hi ${target.name || target.businessName},\n\n` +
        `Quick note from Glow support — reply if you need a hand.\n\nBrian`;
      await sendEmail({
        to: target.email,
        subject: "A quick note from Glow",
        text,
        html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${text.replace(/</g, "&lt;")}</pre>`,
        kind: `owner_${kind}`,
        techId: target.id,
      });
      await ownerSb().from("owner_notes").insert({
        id: randomId("onote"),
        techId: id,
        body: `Bulk nudge sent: ${kind}`,
        authorEmail: admin.email,
        createdAt: new Date().toISOString(),
      });
    }
    await writeOwnerAudit({
      actorEmail: admin.email,
      action: "bulk_nudge",
      metadata: { count: ids.length, kind },
    });
  } else {
    redirect("/dashboard/admin/accounts?err=action");
  }

  revalidatePath("/dashboard/admin/accounts");
  redirect(`/dashboard/admin/accounts?ok=bulk_${action}`);
}

export async function saveAccountViewAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/dashboard/admin/accounts?err=view_name");
  const filters: AccountFilters = {
    q: String(formData.get("q") ?? "").trim() || undefined,
    status: String(formData.get("status") ?? "").trim() || undefined,
    tag: String(formData.get("tag") ?? "").trim() || undefined,
    healthBand: String(formData.get("healthBand") ?? "").trim() || undefined,
    atRisk: formData.get("atRisk") === "1",
  };
  const sort = String(formData.get("sort") ?? "createdAt");
  const columns = String(formData.get("columns") ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  await saveView({
    ownerEmail: admin.email,
    name,
    columns: columns.length ? columns : ["account", "status", "health", "mrr", "flags"],
    filters,
    sort,
  });
  await writeOwnerAudit({
    actorEmail: admin.email,
    action: "saved_view_created",
    metadata: { name },
  });
  revalidatePath("/dashboard/admin/accounts");
  redirect("/dashboard/admin/accounts?ok=view");
}

export async function deleteAccountViewAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  const id = String(formData.get("id") ?? "");
  await deleteSavedView(id, admin.email);
  revalidatePath("/dashboard/admin/accounts");
  redirect("/dashboard/admin/accounts?ok=view_deleted");
}

export async function previewBroadcastAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const filter = String(formData.get("filter") ?? "paying") as BroadcastFilter;
  const tag = String(formData.get("tag") ?? "").trim();
  const includeInternal = formData.get("includeInternal") === "1";
  if (!subject || !body) redirect("/dashboard/admin/broadcast?err=fields");
  const preview = await createBroadcastPreview({
    actorEmail: admin.email,
    subject,
    body,
    filter,
    tag: filter === "tag" ? tag : undefined,
    includeInternal,
  });
  redirect(
    `/dashboard/admin/broadcast?preview=${encodeURIComponent(preview.id)}&count=${preview.recipientCount}`,
  );
}

export async function sendBroadcastAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  if (!confirm(formData)) redirect("/dashboard/admin/broadcast?err=confirm");
  const id = String(formData.get("broadcastId") ?? "");
  const result = await sendBroadcast({ broadcastId: id, actorEmail: admin.email });
  if (result.blocked) {
    redirect(`/dashboard/admin/broadcast?err=${encodeURIComponent(result.blocked)}`);
  }
  redirect(`/dashboard/admin/broadcast?ok=sent&n=${result.sent}`);
}

export async function runOwnerWeeklyDigestAction(formData: FormData) {
  await assertNotViewAs();
  await requireOwner();
  if (!confirm(formData)) redirect("/dashboard/admin/ops?err=confirm");
  const result = await sendOwnerWeeklyDigest("manual");
  redirect(result.ok ? "/dashboard/admin/ops?ok=digest" : "/dashboard/admin/ops?err=digest");
}
