import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createPreCareConfirmation,
  duePreCareConfirmations,
  getBooking,
  getClient,
  getPreCareConfirmationByToken,
  getService,
  getTechById,
  updatePreCareConfirmation,
} from "@/lib/db/queries";
import { notifyClientOfPreCare } from "@/lib/notify";
import type { Booking, PreCareConfirmation, Service, Tech } from "@/lib/db/types";
import { randomToken } from "@/lib/ids";

const HOUR = 60 * 60 * 1000;
/** How long before the appointment to send pre-care instructions. */
export const PRE_CARE_LEAD_HOURS = 48;

function precareInstructions(service: Service | null): string {
  return service?.precareText?.trim() ?? "";
}

/** Schedule a pre-care confirmation when the service has instructions. */
export async function schedulePreCareConfirmation(
  sb: SupabaseClient,
  tech: Tech,
  booking: Booking,
  service?: Service | null,
): Promise<PreCareConfirmation | null> {
  if (tech.preCareConfirmationsEnabled === false) return null;

  const svc = service ?? (await getService(sb, booking.serviceId));
  if (!precareInstructions(svc)) return null;

  const startMs = new Date(booking.startIso).getTime();
  const sendMs = startMs - PRE_CARE_LEAD_HOURS * HOUR;
  const now = Date.now();
  if (now >= startMs) return null;

  const { data: existing } = await sb
    .from("pre_care_confirmations")
    .select("id")
    .eq("bookingId", booking.id)
    .maybeSingle();
  if (existing) return null;

  return createPreCareConfirmation(sb, {
    techId: tech.id,
    clientId: booking.clientId,
    bookingId: booking.id,
    token: randomToken(),
    sendAtIso: new Date(Math.max(sendMs, now)).toISOString(),
    sentAtIso: null,
    status: "scheduled",
    confirmedAtIso: null,
  });
}

/** Skip any pending pre-care row for a booking (cancel / reschedule). */
export async function skipPreCareForBooking(sb: SupabaseClient, bookingId: string): Promise<void> {
  const { data } = await sb
    .from("pre_care_confirmations")
    .select("id, status")
    .eq("bookingId", bookingId)
    .maybeSingle();
  if (!data || data.status !== "scheduled") return;
  await updatePreCareConfirmation(sb, data.id, { status: "skipped" });
}

/** Reschedule pre-care after the appointment time changes. */
export async function reschedulePreCareConfirmation(
  sb: SupabaseClient,
  tech: Tech,
  booking: Booking,
): Promise<void> {
  await skipPreCareForBooking(sb, booking.id);
  await schedulePreCareConfirmation(sb, tech, booking);
}

/** Send one pre-care email/SMS with the confirmation link. */
export async function sendPreCareConfirmation(
  sb: SupabaseClient,
  row: PreCareConfirmation,
): Promise<boolean> {
  if (row.status !== "scheduled") return false;

  const [tech, client, booking] = await Promise.all([
    getTechById(sb, row.techId),
    getClient(sb, row.clientId),
    getBooking(sb, row.bookingId),
  ]);
  const service = booking ? await getService(sb, booking.serviceId) : null;

  if (!tech || !client || !booking || !service) {
    await updatePreCareConfirmation(sb, row.id, { status: "skipped" });
    return false;
  }

  if (tech.preCareConfirmationsEnabled === false) {
    await updatePreCareConfirmation(sb, row.id, { status: "skipped" });
    return false;
  }

  if (!precareInstructions(service)) {
    await updatePreCareConfirmation(sb, row.id, { status: "skipped" });
    return false;
  }

  if (
    booking.status === "cancelled" ||
    booking.status === "no_show" ||
    booking.status === "completed"
  ) {
    await updatePreCareConfirmation(sb, row.id, { status: "skipped" });
    return false;
  }

  if (!client.email?.trim() && !client.phone) {
    await updatePreCareConfirmation(sb, row.id, { status: "skipped" });
    return false;
  }

  const sent = await notifyClientOfPreCare(tech, client, booking, service, row);
  if (!sent) {
    await updatePreCareConfirmation(sb, row.id, { status: "skipped" });
    return false;
  }

  await updatePreCareConfirmation(sb, row.id, {
    status: "sent",
    sentAtIso: new Date().toISOString(),
  });
  return true;
}

/** Client tapped confirm on the public pre-care page. */
export async function submitPreCareConfirmation(
  sb: SupabaseClient,
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const row = await getPreCareConfirmationByToken(sb, token);
  if (!row) return { ok: false, error: "not_found" };
  if (row.status === "confirmed") return { ok: true };
  if (row.status === "skipped") return { ok: false, error: "expired" };

  const booking = await getBooking(sb, row.bookingId);
  if (
    !booking ||
    booking.status === "cancelled" ||
    booking.status === "no_show" ||
    booking.status === "completed"
  ) {
    return { ok: false, error: "expired" };
  }

  await updatePreCareConfirmation(sb, row.id, {
    status: "confirmed",
    confirmedAtIso: new Date().toISOString(),
  });
  return { ok: true };
}

/** Cron: send all due pre-care confirmations. */
export async function processDuePreCareConfirmations(
  sb: SupabaseClient,
  nowIso = new Date().toISOString(),
): Promise<{ sent: number; skipped: number }> {
  const due = await duePreCareConfirmations(sb, nowIso);
  let sent = 0;
  let skipped = 0;

  for (const row of due) {
    const ok = await sendPreCareConfirmation(sb, row);
    if (ok) sent++;
    else skipped++;
  }

  return { sent, skipped };
}

/** Load the pre-care row for a booking (dashboard). */
export async function preCareForBooking(
  sb: SupabaseClient,
  bookingId: string,
): Promise<PreCareConfirmation | null> {
  const { data } = await sb
    .from("pre_care_confirmations")
    .select("*")
    .eq("bookingId", bookingId)
    .maybeSingle();
  return data as PreCareConfirmation | null;
}
