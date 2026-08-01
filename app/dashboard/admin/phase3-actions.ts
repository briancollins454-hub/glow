"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/owner/require-owner";
import { assertNotViewAs } from "@/lib/owner/view-as";
import {
  setKillSwitch,
  setAccountOutboundPaused,
  type KillSwitchKey,
} from "@/lib/owner/controls";
import { cancelAllOutboundForTech, cancelOutboundSend } from "@/lib/owner/outbound";
import { dismissAlert } from "@/lib/owner/alerts";
import { resolveErrorGroup } from "@/lib/owner/error-groups";
import { replayStripeWebhookEvent } from "@/lib/owner/webhooks";
import { setFeatureFlagGlobal, setFeatureFlagOverride } from "@/lib/owner/flags";
import { writeOwnerAudit } from "@/lib/owner/owner-audit-log";
import { isConfirmed } from "@/lib/owner/confirm";

function isNextRedirect(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    String((e as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

export async function setKillSwitchAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  if (!isConfirmed(formData)) redirect("/dashboard/admin/controls?err=confirm");
  const key = String(formData.get("key") ?? "") as KillSwitchKey;
  const paused = formData.get("paused") === "1";
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) redirect("/dashboard/admin/controls?err=reason");
  await setKillSwitch({ key, paused, byEmail: admin.email, reason });
  revalidatePath("/dashboard/admin");
  redirect("/dashboard/admin/controls?ok=1");
}

export async function setAccountOutboundPauseAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  const id = String(formData.get("id") ?? "");
  if (!isConfirmed(formData)) redirect(`/dashboard/admin/accounts/${id}?err=confirm`);
  const paused = formData.get("paused") === "1";
  const reason = String(formData.get("reason") ?? "").trim() || (paused ? "Paused by owner" : "Resumed");
  await setAccountOutboundPaused({ techId: id, paused, byEmail: admin.email, reason });
  revalidatePath(`/dashboard/admin/accounts/${id}`);
  redirect(`/dashboard/admin/accounts/${id}?ok=outbound`);
}

export async function cancelOutboundSendAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  if (!isConfirmed(formData)) redirect("/dashboard/admin/outbound?err=confirm");
  const reminderId = String(formData.get("reminderId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reminderId || !reason) redirect("/dashboard/admin/outbound?err=reason");
  try {
    await cancelOutboundSend({ reminderId, byEmail: admin.email, reason });
  } catch {
    redirect("/dashboard/admin/outbound?err=cancel");
  }
  revalidatePath("/dashboard/admin/outbound");
  redirect("/dashboard/admin/outbound?ok=cancel");
}

export async function cancelAllOutboundAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  const techId = String(formData.get("techId") ?? "");
  if (!isConfirmed(formData)) redirect(`/dashboard/admin/outbound?tech=${techId}&err=confirm`);
  const reason = String(formData.get("reason") ?? "").trim();
  if (!techId || !reason) redirect("/dashboard/admin/outbound?err=reason");
  await cancelAllOutboundForTech({ techId, byEmail: admin.email, reason });
  revalidatePath("/dashboard/admin/outbound");
  redirect(`/dashboard/admin/outbound?tech=${encodeURIComponent(techId)}&ok=cancel_all`);
}

export async function dismissAlertAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  const id = String(formData.get("id") ?? "");
  await dismissAlert(id, admin.email);
  await writeOwnerAudit({
    actorEmail: admin.email,
    action: "dismiss_alert",
    metadata: { id },
  });
  revalidatePath("/dashboard/admin/alerts");
  redirect("/dashboard/admin/alerts?ok=1");
}

export async function resolveErrorGroupAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  if (!isConfirmed(formData)) redirect("/dashboard/admin/errors?err=confirm");
  const signature = String(formData.get("signature") ?? "");
  await resolveErrorGroup(signature, admin.email);
  revalidatePath("/dashboard/admin/errors");
  redirect("/dashboard/admin/errors?ok=1");
}

export async function replayWebhookAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  if (!isConfirmed(formData)) redirect("/dashboard/admin/webhooks?err=confirm");
  const eventId = String(formData.get("eventId") ?? "");
  const result = await replayStripeWebhookEvent(eventId);
  await writeOwnerAudit({
    actorEmail: admin.email,
    action: "replay_stripe_webhook",
    metadata: { eventId, ...result },
  });
  revalidatePath("/dashboard/admin/webhooks");
  redirect(result.ok ? "/dashboard/admin/webhooks?ok=replay" : "/dashboard/admin/webhooks?err=replay");
}

export async function setFlagGlobalAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  if (!isConfirmed(formData)) redirect("/dashboard/admin/flags?err=confirm");
  const key = String(formData.get("key") ?? "");
  const enabled = formData.get("enabled") === "1";
  await setFeatureFlagGlobal({ key, enabled, byEmail: admin.email });
  revalidatePath("/dashboard/admin/flags");
  redirect("/dashboard/admin/flags?ok=1");
}

export async function setFlagOverrideAction(formData: FormData) {
  await assertNotViewAs();
  const { tech: admin } = await requireOwner();
  if (!isConfirmed(formData)) redirect("/dashboard/admin/flags?err=confirm");
  const key = String(formData.get("key") ?? "");
  const techId = String(formData.get("techId") ?? "");
  const enabled = formData.get("enabled") === "1";
  await setFeatureFlagOverride({ key, techId, enabled, byEmail: admin.email });
  revalidatePath("/dashboard/admin/flags");
  revalidatePath(`/dashboard/admin/accounts/${techId}`);
  redirect("/dashboard/admin/flags?ok=override");
}

export async function safePhase3Action(fn: () => Promise<void>, fallback: string) {
  try {
    await fn();
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    console.error("[phase3]", (e as Error).message);
    redirect(fallback);
  }
}
