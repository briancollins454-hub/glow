/**
 * Outbound preview (Phase 3.1) — what Glow will send on an account's behalf.
 * Source of truth for "will fire" is reminders (status=scheduled); mirrored to scheduled_sends.
 */

import { supabaseService } from "@/lib/supabase/service";
import { writeOwnerAudit } from "@/lib/owner/owner-audit-log";
import { markReminder } from "@/lib/db/queries";
import { labelForKind, renderReminderText } from "@/lib/reminder-copy";
import type { Booking, Client, Reminder, Service, Tech } from "@/lib/db/types";

export type UpcomingSend = {
  id: string;
  source: "reminder" | "scheduled_sends";
  sourceId: string;
  techId: string;
  techLabel: string;
  bookingId: string | null;
  clientId: string | null;
  kind: string;
  channel: "email" | "sms";
  destination: string;
  scheduledFor: string;
  triggerLabel: string;
  subject: string;
  bodyPreview: string;
  marketing: boolean;
  status: string;
};

const MARKETING = new Set(["rebook_nudge", "onboarding_nudge"]);

function triggerForKind(kind: string): string {
  switch (kind) {
    case "confirmation":
      return "Booking created / confirmed";
    case "reminder_24h":
      return "24h before appointment start";
    case "reminder_2h":
      return "2h before appointment start";
    case "balance_request":
      return "48h before appointment (balance due)";
    case "patch_test_retest":
      return "Patch test retest required";
    default:
      return `Scheduled ${kind}`;
  }
}

/** Mirror a reminder into scheduled_sends (best-effort; never blocks booking flow). */
export async function mirrorReminderToScheduledSends(
  reminder: Reminder,
  opts?: { destination?: string; bodyPreview?: string; subject?: string },
): Promise<void> {
  try {
    const sb = supabaseService();
    const row = {
      id: `ssend_${reminder.id}`,
      techId: reminder.techId,
      bookingId: reminder.bookingId,
      clientId: reminder.clientId,
      kind: reminder.kind,
      destination: opts?.destination ?? "",
      scheduledFor: reminder.sendAtIso,
      status:
        reminder.status === "scheduled"
          ? "pending"
          : reminder.status === "sent"
            ? "sent"
            : "skipped",
      channel: reminder.channel === "sms" ? "sms" : "email",
      sourceTable: "reminders",
      sourceId: reminder.id,
      marketing: MARKETING.has(reminder.kind),
      triggerLabel: triggerForKind(reminder.kind),
      bodyPreview: (opts?.bodyPreview || reminder.preview || "").slice(0, 4000),
      subject: opts?.subject ?? labelForKind(reminder.kind),
      payloadPreview: { reminderId: reminder.id, kind: reminder.kind },
      createdAt: new Date().toISOString(),
    };
    const { error } = await sb.from("scheduled_sends").upsert(row, { onConflict: "id" });
    if (error) throw error;
  } catch {
    // Table/index may be missing until 0060.
  }
}

export async function listUpcomingOutbound(opts?: {
  techId?: string;
  withinHours?: number;
  limit?: number;
}): Promise<UpcomingSend[]> {
  const sb = supabaseService();
  const hours = opts?.withinHours ?? 24 * 7;
  const until = new Date(Date.now() + hours * 3600_000).toISOString();
  const now = new Date().toISOString();
  const limit = opts?.limit ?? 200;

  let q = sb
    .from("reminders")
    .select("*")
    .eq("status", "scheduled")
    .gte("sendAtIso", now)
    .lte("sendAtIso", until)
    .order("sendAtIso", { ascending: true })
    .limit(limit);
  if (opts?.techId) q = q.eq("techId", opts.techId);

  const { data: reminders, error } = await q;
  if (error) throw new Error(error.message);

  const list = (reminders ?? []) as Reminder[];
  if (!list.length) return [];

  const techIds = [...new Set(list.map((r) => r.techId))];
  const bookingIds = [...new Set(list.map((r) => r.bookingId).filter(Boolean))] as string[];
  const clientIds = [...new Set(list.map((r) => r.clientId).filter(Boolean))] as string[];

  const [{ data: techs }, { data: bookings }, { data: clients }] = await Promise.all([
    sb.from("techs").select("id, businessName, handle, email, clientPaymentsEnabled, balanceEmailsEnabled").in("id", techIds),
    bookingIds.length
      ? sb
          .from("bookings")
          .select("id, startIso, pricePennies, depositPennies, balancePennies, balanceToken, serviceId, techId")
          .in("id", bookingIds)
      : Promise.resolve({ data: [] as Booking[] }),
    clientIds.length
      ? sb.from("clients").select("id, name, email, phone").in("id", clientIds)
      : Promise.resolve({ data: [] as Client[] }),
  ]);

  const techMap = new Map((techs ?? []).map((t) => [t.id, t as Tech]));
  const bookingMap = new Map((bookings ?? []).map((b) => [b.id, b as Booking]));
  const clientMap = new Map((clients ?? []).map((c) => [c.id, c as Client]));

  const serviceIds = [...new Set((bookings ?? []).map((b) => b.serviceId).filter(Boolean))] as string[];
  const { data: services } = serviceIds.length
    ? await sb.from("services").select("id, name").in("id", serviceIds)
    : { data: [] as Service[] };
  const serviceMap = new Map((services ?? []).map((s) => [s.id, s as Service]));

  const out: UpcomingSend[] = [];
  for (const r of list) {
    const tech = techMap.get(r.techId) ?? null;
    const booking = r.bookingId ? bookingMap.get(r.bookingId) ?? null : null;
    const client = r.clientId ? clientMap.get(r.clientId) ?? null : null;
    const service = booking?.serviceId ? serviceMap.get(booking.serviceId) ?? null : null;
    let body = r.preview || "";
    try {
      if (booking) {
        body = renderReminderText({
          reminder: r,
          booking,
          client,
          service,
          tech,
        });
      }
    } catch {
      // keep preview
    }
    const destination =
      r.channel === "sms"
        ? client?.phone || ""
        : client?.email || "";
    out.push({
      id: r.id,
      source: "reminder",
      sourceId: r.id,
      techId: r.techId,
      techLabel: tech ? `${tech.businessName || tech.handle} (/${tech.handle})` : r.techId,
      bookingId: r.bookingId,
      clientId: r.clientId,
      kind: r.kind,
      channel: r.channel === "sms" ? "sms" : "email",
      destination,
      scheduledFor: r.sendAtIso,
      triggerLabel: triggerForKind(r.kind),
      subject: labelForKind(r.kind),
      bodyPreview: body,
      marketing: MARKETING.has(r.kind),
      status: r.status,
    });
  }
  return out;
}

export async function countUpcomingForTech(techId: string, withinHours = 24 * 7): Promise<number> {
  const sb = supabaseService();
  const until = new Date(Date.now() + withinHours * 3600_000).toISOString();
  const now = new Date().toISOString();
  const { count } = await sb
    .from("reminders")
    .select("id", { count: "exact", head: true })
    .eq("techId", techId)
    .eq("status", "scheduled")
    .gte("sendAtIso", now)
    .lte("sendAtIso", until);
  return count ?? 0;
}

export async function cancelOutboundSend(opts: {
  reminderId: string;
  byEmail: string;
  reason: string;
}): Promise<void> {
  const sb = supabaseService();
  const { data: rem } = await sb.from("reminders").select("*").eq("id", opts.reminderId).maybeSingle();
  if (!rem) throw new Error("Reminder not found");
  if (rem.status !== "scheduled") throw new Error("Send is not pending");

  await markReminder(sb, opts.reminderId, {
    status: "skipped",
    preview: `[cancelled by owner] ${opts.reason.slice(0, 200)} | ${rem.preview || ""}`.slice(0, 2000),
  });

  await sb
    .from("scheduled_sends")
    .update({
      status: "cancelled",
      cancelledBy: opts.byEmail,
      cancelledReason: opts.reason.slice(0, 500),
    })
    .eq("sourceTable", "reminders")
    .eq("sourceId", opts.reminderId);

  await writeOwnerAudit({
    actorEmail: opts.byEmail,
    action: "cancel_outbound_send",
    targetType: "tech",
    targetId: rem.techId,
    metadata: { reminderId: opts.reminderId, kind: rem.kind, reason: opts.reason },
  });
}

export async function cancelAllOutboundForTech(opts: {
  techId: string;
  byEmail: string;
  reason: string;
}): Promise<number> {
  const upcoming = await listUpcomingOutbound({ techId: opts.techId, withinHours: 24 * 30, limit: 500 });
  let n = 0;
  for (const s of upcoming) {
    await cancelOutboundSend({
      reminderId: s.sourceId,
      byEmail: opts.byEmail,
      reason: opts.reason,
    });
    n++;
  }
  await writeOwnerAudit({
    actorEmail: opts.byEmail,
    action: "cancel_all_outbound_for_tech",
    targetType: "tech",
    targetId: opts.techId,
    metadata: { count: n, reason: opts.reason },
  });
  return n;
}

export function groupByKind(sends: UpcomingSend[]): { kind: string; count: number }[] {
  const map = new Map<string, number>();
  for (const s of sends) map.set(s.kind, (map.get(s.kind) ?? 0) + 1);
  return [...map.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count);
}

/** Pure helper for tests: cancel marks skipped. */
export function cancelledReminderStatus(): "skipped" {
  return "skipped";
}
