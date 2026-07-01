import type { SupabaseClient } from "@supabase/supabase-js";
import { createBooking, createReminder } from "@/lib/db/queries";
import { depositFor } from "@/lib/rules";
import { charge } from "@/lib/payments";
import { sendReminder } from "@/lib/notify";
import { randomToken } from "@/lib/utils";
import type { Booking, Client, Service, Tech } from "@/lib/db/types";

const HOUR = 60 * 60 * 1000;

interface CreateParams {
  sb: SupabaseClient;
  tech: Tech;
  service: Service;
  client: Client;
  startIso: string;
  isPatchTest?: boolean;
  notes?: string;
  takeDeposit?: boolean;
}

/** Create a confirmed booking: take the deposit (stub), then schedule reminders. */
export async function createConfirmedBooking({
  sb,
  tech,
  service,
  client,
  startIso,
  isPatchTest = false,
  notes = "",
  takeDeposit = true,
}: CreateParams): Promise<Booking> {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + service.durationMin * 60 * 1000);
  const price = service.pricePennies;
  const deposit = depositFor(service);
  const balance = Math.max(0, price - deposit);

  const booking = await createBooking(sb, {
    techId: tech.id,
    clientId: client.id,
    serviceId: service.id,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    status: "confirmed",
    pricePennies: price,
    depositPennies: deposit,
    depositStatus: deposit > 0 && takeDeposit ? "paid" : "none",
    balancePennies: balance,
    balanceStatus: balance > 0 ? "unpaid" : "paid",
    balanceToken: randomToken(),
    isPatchTest,
    notes,
  });

  if (deposit > 0 && takeDeposit) {
    await charge(sb, { techId: tech.id, bookingId: booking.id, kind: "deposit", amountPennies: deposit });
  }

  await scheduleReminders(sb, booking);
  return booking;
}

export async function scheduleReminders(sb: SupabaseClient, booking: Booking): Promise<void> {
  const startMs = new Date(booking.startIso).getTime();

  const confirmation = await createReminder(sb, {
    techId: booking.techId,
    bookingId: booking.id,
    channel: "email",
    kind: "confirmation",
    sendAtIso: new Date().toISOString(),
    status: "scheduled",
    preview: "",
    sentAtIso: null,
  });
  await sendReminder(sb, confirmation);

  const remind24 = startMs - 24 * HOUR;
  if (remind24 > Date.now()) {
    await createReminder(sb, {
      techId: booking.techId,
      bookingId: booking.id,
      channel: "sms",
      kind: "reminder_24h",
      sendAtIso: new Date(remind24).toISOString(),
      status: "scheduled",
      preview: "",
      sentAtIso: null,
    });
  }

  if (booking.balancePennies > 0) {
    const balanceAt = startMs - 48 * HOUR;
    await createReminder(sb, {
      techId: booking.techId,
      bookingId: booking.id,
      channel: "email",
      kind: "balance_request",
      sendAtIso: new Date(Math.max(balanceAt, Date.now())).toISOString(),
      status: "scheduled",
      preview: "",
      sentAtIso: null,
    });
  }
}
