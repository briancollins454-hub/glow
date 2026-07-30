/**
 * Owner broadcast tool (Phase 4) — preview then confirm send.
 */

/** Never allow bulk delete — explicit guard for Phase 4. */
export function assertNotBulkDelete(action: string) {
  if (/delete|destroy|purge/i.test(action)) {
    throw new Error("Bulk delete is not permitted");
  }
}

import { randomId } from "@/lib/ids";
import { supabaseService } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email";
import { writeOwnerAudit, recordPlatformEvent } from "@/lib/owner/owner-audit-log";
import { outboundBlockReason } from "@/lib/owner/controls";
import { filterOutInternal, shouldIncludeInternal } from "@/lib/owner/internal-accounts";
import type { Tech } from "@/lib/db/types";

export type BroadcastFilter =
  | "paying"
  | "trialing"
  | "at_risk"
  | "tag"
  | "all_live";

export async function resolveBroadcastRecipients(opts: {
  filter: BroadcastFilter;
  tag?: string;
  includeInternal?: boolean;
}): Promise<Tech[]> {
  const sb = supabaseService();
  let q = sb
    .from("techs")
    .select("id, email, name, businessName, handle, subscriptionStatus, isInternal, atRiskManual, ownerTags, healthBand")
    .limit(2000);

  if (opts.filter === "paying") q = q.eq("subscriptionStatus", "active");
  else if (opts.filter === "trialing") q = q.eq("subscriptionStatus", "trialing");
  else if (opts.filter === "at_risk") {
    // manual flag or health band
    q = q.or("atRiskManual.eq.true,healthBand.eq.at_risk");
  } else if (opts.filter === "all_live") {
    q = q.in("subscriptionStatus", ["active", "trialing", "comped"]);
  } else if (opts.filter === "tag" && opts.tag) {
    q = q.contains("ownerTags", [opts.tag]);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let techs = (data ?? []) as Tech[];
  if (!opts.includeInternal) {
    const include = await shouldIncludeInternal(sb);
    // Broadcast always excludes internal unless explicitly opted in,
    // regardless of the global metrics toggle.
    void include;
    techs = filterOutInternal(techs, false);
  }
  return techs.filter((t) => !!t.email);
}

export function renderBroadcastPreview(opts: {
  subject: string;
  body: string;
  sampleName: string;
}): { subject: string; text: string } {
  const name = opts.sampleName || "there";
  return {
    subject: opts.subject.replace(/\{\{name\}\}/gi, name),
    text: opts.body.replace(/\{\{name\}\}/gi, name),
  };
}

export async function createBroadcastPreview(opts: {
  actorEmail: string;
  subject: string;
  body: string;
  filter: BroadcastFilter;
  tag?: string;
  includeInternal: boolean;
}): Promise<{ id: string; recipientCount: number; sample: { subject: string; text: string } }> {
  const recipients = await resolveBroadcastRecipients({
    filter: opts.filter,
    tag: opts.tag,
    includeInternal: opts.includeInternal,
  });
  const id = randomId("obc");
  const sample = renderBroadcastPreview({
    subject: opts.subject,
    body: opts.body,
    sampleName: recipients[0]?.name || recipients[0]?.businessName || "there",
  });
  await supabaseService().from("owner_broadcasts").insert({
    id,
    actorEmail: opts.actorEmail,
    subject: opts.subject,
    body: opts.body,
    filter: { filter: opts.filter, tag: opts.tag ?? null },
    includeInternal: opts.includeInternal,
    recipientCount: recipients.length,
    recipientIds: recipients.map((t) => t.id),
    status: "previewed",
    createdAt: new Date().toISOString(),
  });
  await writeOwnerAudit({
    actorEmail: opts.actorEmail,
    action: "broadcast_preview",
    metadata: { id, count: recipients.length, filter: opts.filter },
  });
  return { id, recipientCount: recipients.length, sample };
}

export async function sendBroadcast(opts: {
  broadcastId: string;
  actorEmail: string;
}): Promise<{ sent: number; skipped: number; blocked: string | null }> {
  const blocked = await outboundBlockReason({ kind: "owner_broadcast" });
  if (blocked) return { sent: 0, skipped: 0, blocked };

  const sb = supabaseService();
  const { data: row } = await sb
    .from("owner_broadcasts")
    .select("*")
    .eq("id", opts.broadcastId)
    .maybeSingle();
  if (!row || row.status === "sent") {
    return { sent: 0, skipped: 0, blocked: row?.status === "sent" ? "already_sent" : "not_found" };
  }

  const ids: string[] = row.recipientIds ?? [];
  let sent = 0;
  let skipped = 0;
  for (const techId of ids.slice(0, 500)) {
    const { data: tech } = await sb
      .from("techs")
      .select("id, email, name, businessName")
      .eq("id", techId)
      .maybeSingle();
    if (!tech?.email) {
      skipped++;
      continue;
    }
    const preview = renderBroadcastPreview({
      subject: row.subject,
      body: row.body,
      sampleName: tech.name || tech.businessName || "there",
    });
    const ok = await sendEmail({
      to: tech.email,
      subject: preview.subject,
      text: preview.text,
      html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${preview.text.replace(/</g, "&lt;")}</pre>`,
      kind: "owner_broadcast",
      techId: tech.id,
      idempotencyKey: `broadcast:${opts.broadcastId}:${tech.id}`,
    });
    if (ok) sent++;
    else skipped++;
  }

  await sb
    .from("owner_broadcasts")
    .update({ status: "sent", sentAt: new Date().toISOString(), recipientCount: sent })
    .eq("id", opts.broadcastId);

  await writeOwnerAudit({
    actorEmail: opts.actorEmail,
    action: "broadcast_sent",
    metadata: { id: opts.broadcastId, sent, skipped },
  });
  await recordPlatformEvent({
    type: "broadcast",
    severity: "info",
    title: `Broadcast sent to ${sent} accounts`,
    detail: { id: opts.broadcastId, skipped },
  });

  return { sent, skipped, blocked: null };
}
