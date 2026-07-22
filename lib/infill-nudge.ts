import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createInfillDeadlineNudge,
  dueInfillDeadlineNudges,
  getBooking,
  getClient,
  getService,
  getTechById,
  listBookings,
  listServices,
  updateInfillDeadlineNudge,
} from "@/lib/db/queries";
import { notifyClientOfInfillDeadline } from "@/lib/notify";
import { isValidEmail } from "@/lib/email";
import type { Booking, InfillDeadlineNudge, Service, Tech } from "@/lib/db/types";

const DAY = 24 * 60 * 60 * 1000;
/** Days before the infill window closes to send the reminder. */
export const INFILL_NUDGE_LEAD_DAYS = 3;

/** Find the infill service a completed full set should nudge towards. */
export function findInfillForCompletedService(
  services: Service[],
  completed: Service,
): Service | null {
  if (completed.isInfill || completed.isPatchTestService) return null;

  const linked = services.find(
    (s) => s.active && s.isInfill && s.fullSetServiceId === completed.id,
  );
  if (linked) return linked;

  const inCategory = services.filter(
    (s) => s.active && s.isInfill && s.categoryId === completed.categoryId,
  );
  if (inCategory.length === 1) return inCategory[0] ?? null;
  return null;
}

function hasReturnVisitSince(
  bookings: Booking[],
  clientId: string,
  categoryId: string,
  afterMs: number,
  categoryByServiceId: Map<string, string>,
): boolean {
  return bookings.some((b) => {
    if (b.clientId !== clientId) return false;
    if (categoryByServiceId.get(b.serviceId) !== categoryId) return false;
    if (b.status !== "completed" && b.status !== "confirmed") return false;
    return new Date(b.startIso).getTime() > afterMs;
  });
}

function hasUpcomingInCategory(
  bookings: Booking[],
  clientId: string,
  categoryId: string,
  nowMs: number,
  categoryByServiceId: Map<string, string>,
): boolean {
  return bookings.some((b) => {
    if (b.clientId !== clientId) return false;
    if (categoryByServiceId.get(b.serviceId) !== categoryId) return false;
    if (new Date(b.startIso).getTime() <= nowMs) return false;
    return b.status === "confirmed" || b.status === "pending" || b.status === "pending_approval";
  });
}

/** Schedule a reminder before the client's infill window closes. */
export async function scheduleInfillDeadlineNudge(
  sb: SupabaseClient,
  tech: Tech,
  booking: Booking,
  completedService: Service,
  infillService: Service,
): Promise<InfillDeadlineNudge | null> {
  if (tech.infillNudgesEnabled === false) return null;

  const anchorMs = new Date(booking.endIso || booking.startIso).getTime();
  const gapDays = infillService.infillMaxGapDays || 21;
  const deadlineMs = anchorMs + gapDays * DAY;
  const sendMs = deadlineMs - INFILL_NUDGE_LEAD_DAYS * DAY;
  const now = Date.now();

  if (now >= deadlineMs) return null;

  const { data: existing } = await sb
    .from("infill_deadline_nudges")
    .select("id")
    .eq("baseBookingId", booking.id)
    .maybeSingle();
  if (existing) return null;

  return createInfillDeadlineNudge(sb, {
    techId: tech.id,
    clientId: booking.clientId,
    baseBookingId: booking.id,
    infillServiceId: infillService.id,
    deadlineIso: new Date(deadlineMs).toISOString(),
    sendAtIso: new Date(Math.max(sendMs, now)).toISOString(),
    sentAtIso: null,
    status: "scheduled",
  });
}

/** Send one infill deadline nudge if still relevant. */
export async function sendInfillDeadlineNudge(
  sb: SupabaseClient,
  nudge: InfillDeadlineNudge,
): Promise<boolean> {
  const [tech, client, infillService, baseBooking] = await Promise.all([
    getTechById(sb, nudge.techId),
    getClient(sb, nudge.clientId),
    getService(sb, nudge.infillServiceId),
    getBooking(sb, nudge.baseBookingId),
  ]);

  if (!tech || !client || !infillService || !baseBooking) {
    await updateInfillDeadlineNudge(sb, nudge.id, { status: "skipped" });
    return false;
  }

  if (tech.infillNudgesEnabled === false) {
    await updateInfillDeadlineNudge(sb, nudge.id, { status: "skipped" });
    return false;
  }

  if (!client.email?.trim() || !isValidEmail(client.email) || client.isBlacklisted || client.marketingOptOut) {
    await updateInfillDeadlineNudge(sb, nudge.id, { status: "skipped" });
    return false;
  }

  const now = Date.now();
  if (now >= new Date(nudge.deadlineIso).getTime()) {
    await updateInfillDeadlineNudge(sb, nudge.id, { status: "skipped" });
    return false;
  }

  const [bookings, services] = await Promise.all([
    listBookings(sb, tech.id),
    listServices(sb, tech.id),
  ]);
  const categoryByServiceId = new Map(services.map((s) => [s.id, s.categoryId]));
  const baseMs = new Date(baseBooking.startIso).getTime();

  if (
    hasUpcomingInCategory(bookings, client.id, infillService.categoryId, now, categoryByServiceId) ||
    hasReturnVisitSince(bookings, client.id, infillService.categoryId, baseMs, categoryByServiceId)
  ) {
    await updateInfillDeadlineNudge(sb, nudge.id, { status: "skipped" });
    return false;
  }

  const sent = await notifyClientOfInfillDeadline(tech, client, infillService, nudge.deadlineIso);
  if (!sent) {
    await updateInfillDeadlineNudge(sb, nudge.id, { status: "skipped" });
    return false;
  }

  await updateInfillDeadlineNudge(sb, nudge.id, {
    status: "sent",
    sentAtIso: new Date().toISOString(),
  });
  return true;
}

/** Cron: send all due infill deadline nudges. */
export async function processInfillDeadlineNudges(
  sb: SupabaseClient,
  nowIso = new Date().toISOString(),
): Promise<{ sent: number; skipped: number }> {
  const due = await dueInfillDeadlineNudges(sb, nowIso);
  let sent = 0;
  let skipped = 0;

  for (const nudge of due) {
    const ok = await sendInfillDeadlineNudge(sb, nudge);
    if (ok) sent++;
    else skipped++;
  }

  return { sent, skipped };
}

/** Called when a full-set appointment is marked completed. */
export async function maybeScheduleInfillNudgeForBooking(
  sb: SupabaseClient,
  tech: Tech,
  booking: Booking,
): Promise<void> {
  const service = await getService(sb, booking.serviceId);
  if (!service) return;

  const services = await listServices(sb, tech.id);
  const infill = findInfillForCompletedService(services, service);
  if (!infill) return;

  await scheduleInfillDeadlineNudge(sb, tech, booking, service, infill);
}
