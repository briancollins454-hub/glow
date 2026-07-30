/**
 * Unified account timeline (Phase 4).
 */

import { supabaseService } from "@/lib/supabase/service";

export type TimelineItem = {
  id: string;
  at: string;
  source: "booking" | "payment" | "outbound" | "note" | "owner_audit" | "platform" | "audit" | "flag";
  title: string;
  detail?: string;
};

export async function getAccountTimeline(techId: string, limit = 80): Promise<TimelineItem[]> {
  const sb = supabaseService();
  const [
    bookings,
    payments,
    outbound,
    notes,
    ownerAudit,
    platform,
    audits,
    tech,
  ] = await Promise.all([
    sb
      .from("bookings")
      .select("id, startIso, status, createdAt")
      .eq("techId", techId)
      .order("createdAt", { ascending: false })
      .limit(30),
    sb
      .from("payments")
      .select("id, kind, status, amountPennies, createdAt")
      .eq("techId", techId)
      .order("createdAt", { ascending: false })
      .limit(30),
    sb
      .from("outbound_sends")
      .select("id, kind, destination, ok, deliveryStatus, createdAt")
      .eq("techId", techId)
      .order("createdAt", { ascending: false })
      .limit(40),
    sb
      .from("owner_notes")
      .select("id, body, authorEmail, createdAt")
      .eq("techId", techId)
      .order("createdAt", { ascending: false })
      .limit(40),
    sb
      .from("owner_audit")
      .select("id, action, actorEmail, metadata, createdAt")
      .eq("targetId", techId)
      .order("createdAt", { ascending: false })
      .limit(40),
    sb
      .from("platform_events")
      .select("id, type, title, severity, createdAt")
      .eq("techId", techId)
      .order("createdAt", { ascending: false })
      .limit(40),
    sb
      .from("audit_events")
      .select("id, action, actor, entityType, metadata, createdAt")
      .eq("techId", techId)
      .order("createdAt", { ascending: false })
      .limit(40),
    sb.from("techs").select("ownerTags, atRiskManual, isInternal, subscriptionStatus").eq("id", techId).maybeSingle(),
  ]);

  const items: TimelineItem[] = [];

  for (const b of bookings.data ?? []) {
    items.push({
      id: `bk_${b.id}`,
      at: b.createdAt || b.startIso,
      source: "booking",
      title: `Booking ${b.status}`,
      detail: b.startIso,
    });
  }
  for (const p of payments.data ?? []) {
    items.push({
      id: `pay_${p.id}`,
      at: p.createdAt,
      source: "payment",
      title: `Payment ${p.kind} · ${p.status}`,
      detail: `${p.amountPennies}p`,
    });
  }
  for (const o of outbound.data ?? []) {
    items.push({
      id: `out_${o.id}`,
      at: o.createdAt,
      source: "outbound",
      title: `Email ${o.kind}`,
      detail: `${o.destination} · ${o.deliveryStatus || (o.ok ? "sent" : "failed")}`,
    });
  }
  for (const n of notes.data ?? []) {
    items.push({
      id: `note_${n.id}`,
      at: n.createdAt,
      source: "note",
      title: `Note by ${n.authorEmail}`,
      detail: n.body,
    });
  }
  for (const a of ownerAudit.data ?? []) {
    items.push({
      id: `oaud_${a.id}`,
      at: a.createdAt,
      source: "owner_audit",
      title: a.action,
      detail: a.actorEmail,
    });
  }
  for (const e of platform.data ?? []) {
    items.push({
      id: `pevt_${e.id}`,
      at: e.createdAt,
      source: "platform",
      title: e.title,
      detail: `${e.type} · ${e.severity}`,
    });
  }
  for (const a of audits.data ?? []) {
    items.push({
      id: `aud_${a.id}`,
      at: a.createdAt,
      source: "audit",
      title: a.action,
      detail: `${a.actor} · ${a.entityType}`,
    });
  }

  if (tech.data) {
    if (tech.data.atRiskManual) {
      items.push({
        id: "flag_atrisk",
        at: new Date().toISOString(),
        source: "flag",
        title: "Manual at-risk flag",
        detail: "active",
      });
    }
    if (Array.isArray(tech.data.ownerTags) && tech.data.ownerTags.length) {
      items.push({
        id: "flag_tags",
        at: new Date().toISOString(),
        source: "flag",
        title: "Owner tags",
        detail: tech.data.ownerTags.join(", "),
      });
    }
  }

  return items
    .filter((i) => i.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

export async function listOwnerNotes(techId: string, limit = 50) {
  const { data } = await supabaseService()
    .from("owner_notes")
    .select("*")
    .eq("techId", techId)
    .order("createdAt", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function listSettingsHistory(techId: string, limit = 40) {
  const { data } = await supabaseService()
    .from("audit_events")
    .select("*")
    .eq("techId", techId)
    .eq("action", "settings_updated")
    .order("createdAt", { ascending: false })
    .limit(limit);
  return data ?? [];
}
