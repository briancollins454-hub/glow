import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createLateCascadeEvent,
  createLateCascadeNotification,
  getClient,
  getService,
  listBookings,
} from "@/lib/db/queries";
import { notifyClientRunningLate } from "@/lib/notify";
import { fmtTime } from "@/lib/format";
import { dateStrInTz } from "@/lib/rules";
import type { Booking, Tech } from "@/lib/db/types";

const ACTIVE_STATUSES: Booking["status"][] = ["pending_approval", "pending", "confirmed"];
/** Include appointments that started up to this long ago (client still waiting). */
const GRACE_MS = 30 * 60 * 1000;

export type LateCascadeInput = {
  minutesLate: number;
  note?: string;
  /** yyyy-mm-dd in Europe/London; defaults to today. */
  targetDate?: string;
};

export type LateCascadeResult = {
  eventId: string;
  bookingsTargeted: number;
  clientsNotified: number;
  emails: number;
  sms: number;
};

/** Bookings on a given day that should receive a running-late notice. */
export function filterLateCascadeBookings(
  bookings: Booking[],
  targetDate: string,
  nowMs = Date.now(),
): Booking[] {
  return bookings
    .filter((b) => {
      if (!ACTIVE_STATUSES.includes(b.status)) return false;
      if (dateStrInTz(new Date(b.startIso)) !== targetDate) return false;
      const endMs = new Date(b.endIso || b.startIso).getTime();
      if (endMs <= nowMs) return false;
      const startMs = new Date(b.startIso).getTime();
      if (startMs < nowMs - GRACE_MS) return false;
      return true;
    })
    .sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());
}

export function todayDateStr(now = new Date()): string {
  return dateStrInTz(now);
}

/** Notify all remaining clients on the target day that the tech is running late. */
export async function executeRunningLateCascade(
  sb: SupabaseClient,
  tech: Tech,
  input: LateCascadeInput,
): Promise<LateCascadeResult> {
  const minutesLate = Math.min(240, Math.max(1, Math.round(input.minutesLate)));
  const targetDate = input.targetDate?.trim() || todayDateStr();
  const note = input.note?.trim() ?? "";
  const nowMs = Date.now();

  const bookings = filterLateCascadeBookings(
    await listBookings(sb, tech.id),
    targetDate,
    nowMs,
  );

  const event = await createLateCascadeEvent(sb, {
    techId: tech.id,
    minutesLate,
    note,
    targetDate,
    bookingsNotified: 0,
  });

  let emails = 0;
  let sms = 0;
  let clientsNotified = 0;
  const notifiedClients = new Set<string>();

  for (const booking of bookings) {
    const [client, service] = await Promise.all([
      getClient(sb, booking.clientId),
      getService(sb, booking.serviceId),
    ]);
    if (!client) continue;

    const sent = await notifyClientRunningLate({
      tech,
      client,
      booking,
      service,
      minutesLate,
      note,
      eventId: event.id,
    });

    if (sent.email) {
      emails++;
      await createLateCascadeNotification(sb, {
        eventId: event.id,
        techId: tech.id,
        bookingId: booking.id,
        clientId: client.id,
        channel: "email",
      });
    }
    if (sent.sms) {
      sms++;
      await createLateCascadeNotification(sb, {
        eventId: event.id,
        techId: tech.id,
        bookingId: booking.id,
        clientId: client.id,
        channel: "sms",
      });
    }

    if ((sent.email || sent.sms) && !notifiedClients.has(client.id)) {
      notifiedClients.add(client.id);
      clientsNotified++;
    }
  }

  await sb
    .from("late_cascade_events")
    .update({ bookingsNotified: clientsNotified })
    .eq("id", event.id);

  return {
    eventId: event.id,
    bookingsTargeted: bookings.length,
    clientsNotified,
    emails,
    sms,
  };
}

/** Human label for a booking in the cascade preview. */
export function lateCascadeBookingLabel(
  booking: Booking,
  clientName: string,
  serviceName: string,
): string {
  return `${clientName} · ${serviceName} · ${fmtTime(booking.startIso)}`;
}
