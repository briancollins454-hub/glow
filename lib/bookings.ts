import {
  createBooking,
  createReminder,
  getService,
  getTechById,
} from "@/lib/db/repo";
import { depositFor } from "@/lib/rules";
import { charge } from "@/lib/payments";
import { sendReminder } from "@/lib/notify";
import { randomToken } from "@/lib/utils";
import type { Booking, Client, Service, Tech } from "@/lib/db/types";

const HOUR = 60 * 60 * 1000;

interface CreateParams {
  tech: Tech;
  service: Service;
  client: Client;
  startIso: string;
  isPatchTest?: boolean;
  notes?: string;
  // Online bookings take the deposit immediately; manual ones collect in person.
  takeDeposit?: boolean;
}

/** Create a confirmed booking: takes the deposit (stub), then schedules reminders. */
export async function createConfirmedBooking({
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

  const booking = createBooking({
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
    await charge({
      techId: tech.id,
      bookingId: booking.id,
      kind: "deposit",
      amountPennies: deposit,
    });
  }

  await scheduleReminders(booking);
  return booking;
}

/** Schedule confirmation (now), 24h reminder, and balance request (48h before). */
export async function scheduleReminders(booking: Booking): Promise<void> {
  const startMs = new Date(booking.startIso).getTime();

  // Confirmation, sent immediately
  const confirmation = createReminder({
    techId: booking.techId,
    bookingId: booking.id,
    channel: "email",
    kind: "confirmation",
    sendAtIso: new Date().toISOString(),
    status: "scheduled",
    preview: "",
    sentAtIso: null,
  });
  await sendReminder(confirmation);

  // 24h reminder
  const remind24 = startMs - 24 * HOUR;
  if (remind24 > Date.now()) {
    createReminder({
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

  // Balance request 48h before, only if there is a balance
  if (booking.balancePennies > 0) {
    const balanceAt = startMs - 48 * HOUR;
    createReminder({
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

/** Helper used by server components to hydrate a booking row with relations. */
export function bookingView(booking: Booking) {
  return {
    booking,
    service: getService(booking.serviceId),
    tech: getTechById(booking.techId),
  };
}
