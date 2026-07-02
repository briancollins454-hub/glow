import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createBooking,
  createPayment,
  createReminder,
  updateBooking,
} from "@/lib/db/queries";
import { depositFor } from "@/lib/rules";
import { sendReminder } from "@/lib/notify";
import { randomToken } from "@/lib/utils";
import type { Booking, Client, Service, Tech } from "@/lib/db/types";

const HOUR = 60 * 60 * 1000;

interface BaseParams {
  sb: SupabaseClient;
  tech: Tech;
  service: Service;
  client: Client;
  startIso: string;
  isPatchTest?: boolean;
  notes?: string;
}

function amounts(service: Service) {
  const price = service.pricePennies;
  const deposit = depositFor(service);
  return { price, deposit, balance: Math.max(0, price - deposit) };
}

/** Confirmed booking with no online payment (manual/in-person, or deposit-free). */
export async function createConfirmedBooking({
  sb,
  tech,
  service,
  client,
  startIso,
  isPatchTest = false,
  notes = "",
}: BaseParams): Promise<Booking> {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + service.durationMin * 60 * 1000);
  const { price, deposit, balance } = amounts(service);

  const booking = await createBooking(sb, {
    techId: tech.id,
    clientId: client.id,
    serviceId: service.id,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    status: "confirmed",
    pricePennies: price,
    depositPennies: deposit,
    depositStatus: "none",
    balancePennies: balance,
    balanceStatus: balance > 0 ? "unpaid" : "paid",
    balanceToken: randomToken(),
    isPatchTest,
    notes,
  });

  await scheduleReminders(sb, booking);
  return booking;
}

/** Pending booking awaiting an online deposit payment (confirmed once paid). */
export async function createPendingOnlineBooking({
  sb,
  tech,
  service,
  client,
  startIso,
  isPatchTest = false,
  notes = "",
}: BaseParams): Promise<Booking> {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + service.durationMin * 60 * 1000);
  const { price, deposit, balance } = amounts(service);

  return createBooking(sb, {
    techId: tech.id,
    clientId: client.id,
    serviceId: service.id,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    status: "pending",
    pricePennies: price,
    depositPennies: deposit,
    depositStatus: "none",
    balancePennies: balance,
    balanceStatus: balance > 0 ? "unpaid" : "paid",
    balanceToken: randomToken(),
    isPatchTest,
    notes,
  });
}

/** Mark a deposit paid (idempotent): confirm the booking + schedule reminders. */
export async function applyDepositPaid(
  sb: SupabaseClient,
  booking: Booking,
  paymentIntentId: string,
): Promise<void> {
  if (booking.depositStatus === "paid") return;
  await createPayment(sb, {
    techId: booking.techId,
    bookingId: booking.id,
    kind: "deposit",
    amountPennies: booking.depositPennies,
    status: "succeeded",
    provider: "stripe",
    providerRef: paymentIntentId,
  });
  await updateBooking(sb, booking.id, { status: "confirmed", depositStatus: "paid" });
  await scheduleReminders(sb, { ...booking, status: "confirmed", depositStatus: "paid" });
}

/** Mark a balance paid (idempotent). */
export async function applyBalancePaid(
  sb: SupabaseClient,
  booking: Booking,
  paymentIntentId: string,
): Promise<void> {
  if (booking.balanceStatus === "paid") return;
  await createPayment(sb, {
    techId: booking.techId,
    bookingId: booking.id,
    kind: "balance",
    amountPennies: booking.balancePennies,
    status: "succeeded",
    provider: "stripe",
    providerRef: paymentIntentId,
  });
  await updateBooking(sb, booking.id, { balanceStatus: "paid" });
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
      channel: "email",
      kind: "reminder_24h",
      sendAtIso: new Date(remind24).toISOString(),
      status: "scheduled",
      preview: "",
      sentAtIso: null,
    });
  }

  if (booking.balancePennies > 0 && booking.balanceStatus !== "paid") {
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
