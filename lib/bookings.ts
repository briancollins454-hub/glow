import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createBooking,
  createPayment,
  createReminder,
  updateBooking,
} from "@/lib/db/queries";
import { depositFor, bookingAmounts } from "@/lib/rules";
import { sendReminder } from "@/lib/notify";
import { randomToken } from "@/lib/utils";
import { syncBookingToGoogle } from "@/lib/google-calendar";
import type { Booking, BookingAddon, Client, RiskTier, Service, Tech } from "@/lib/db/types";
import { isPaymentsReady } from "@/lib/subscriptions";

const HOUR = 60 * 60 * 1000;

interface BaseParams {
  sb: SupabaseClient;
  tech: Tech;
  service: Service;
  client: Client;
  startIso: string;
  isPatchTest?: boolean;
  notes?: string;
  /** Extras chosen at booking time; added to the price (deposit stays on the base service). */
  addons?: BookingAddon[];
  /** Loyalty (or other) discount off the price. */
  discountPennies?: number;
  pairedBookingId?: string | null;
  /** Risk tier for public bookings (drives deposit). Omit for manual bookings. */
  riskTier?: RiskTier | null;
  /** Override computed deposit (manual bookings). */
  depositOverridePennies?: number | null;
  /** Set when rules mode auto-approved without tech review. */
  autoApproved?: boolean;
}

function amounts(service: Service, addons: BookingAddon[] = [], discountPennies = 0) {
  const extras = addons.reduce((s, a) => s + a.pricePennies, 0);
  const price = Math.max(0, service.pricePennies + extras - discountPennies);
  const deposit = Math.min(depositFor(service), price);
  return { price, deposit, balance: Math.max(0, price - deposit) };
}

function resolveAmounts(
  service: Service,
  tech: Tech,
  addons: BookingAddon[],
  discountPennies: number,
  riskTier?: RiskTier | null,
  depositOverridePennies?: number | null,
) {
  const computed =
    riskTier != null
      ? bookingAmounts(service, tech, riskTier, addons, discountPennies)
      : amounts(service, addons, discountPennies);
  if (depositOverridePennies == null) return computed;
  const deposit = Math.min(Math.max(0, depositOverridePennies), computed.price);
  return { ...computed, deposit, balance: Math.max(0, computed.price - deposit) };
}

/**
 * Loyalty discount in pennies. VIP clients always qualify; others qualify by
 * reaching the visit threshold (when the programme is switched on).
 */
export function loyaltyDiscountFor(
  tech: Pick<Tech, "loyaltyVisitThreshold" | "loyaltyDiscountPct"> &
    Partial<Pick<Tech, "loyaltyDiscountType" | "loyaltyDiscountValue">>,
  completedVisits: number,
  grossPennies: number,
  isVip = false,
): number {
  const type = tech.loyaltyDiscountType ?? "percent";
  const value = tech.loyaltyDiscountValue ?? tech.loyaltyDiscountPct;
  if (value <= 0) return 0;
  const qualifies =
    isVip || (tech.loyaltyVisitThreshold > 0 && completedVisits >= tech.loyaltyVisitThreshold);
  if (!qualifies) return 0;
  if (type === "fixed") return Math.min(value, grossPennies);
  return Math.round((grossPennies * value) / 100);
}

export type ManualPaymentTaken = "none" | "deposit" | "full";

/**
 * Confirmed booking created by the tech (walk-in, DM, phone). Optionally
 * records money already taken offline (cash, bank transfer, PayPal...).
 */
export async function createConfirmedBooking({
  sb,
  tech,
  service,
  client,
  startIso,
  isPatchTest = false,
  notes = "",
  paymentTaken = "none",
  paymentMethod = "in_person",
  depositOverridePennies = null,
  addons = [],
  discountPennies = 0,
  pairedBookingId = null,
  riskTier = null,
  autoApproved = false,
}: BaseParams & {
  paymentTaken?: ManualPaymentTaken;
  paymentMethod?: string;
  depositOverridePennies?: number | null;
}): Promise<Booking> {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + service.durationMin * 60 * 1000);
  const base =
    riskTier != null
      ? resolveAmounts(service, tech, addons, discountPennies, riskTier)
      : amounts(service, addons, discountPennies);
  const price = base.price;
  const deposit =
    depositOverridePennies !== null
      ? Math.min(Math.max(0, depositOverridePennies), price)
      : base.deposit;
  const balance = Math.max(0, price - deposit);

  const depositPaid = paymentTaken !== "none" && deposit > 0;
  const fullyPaid = paymentTaken === "full";

  const booking = await createBooking(sb, {
    techId: tech.id,
    clientId: client.id,
    serviceId: service.id,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    status: "confirmed",
    pricePennies: price,
    depositPennies: deposit,
    depositStatus: depositPaid ? "paid" : "none",
    balancePennies: balance,
    balanceStatus: fullyPaid || balance === 0 ? "paid" : "unpaid",
    balanceToken: randomToken(),
    approvalToken: null,
    pairedBookingId,
    riskTier,
    autoApproved,
    isPatchTest,
    notes,
    lashMap: "",
    lashCurl: "",
    lashLength: "",
    addons,
    discountPennies,
  });

  if (depositPaid) {
    await createPayment(sb, {
      techId: tech.id,
      bookingId: booking.id,
      kind: "deposit",
      amountPennies: deposit,
      status: "succeeded",
      provider: paymentMethod,
      providerRef: "",
    });
  }
  if (fullyPaid && balance > 0) {
    await createPayment(sb, {
      techId: tech.id,
      bookingId: booking.id,
      kind: "balance",
      amountPennies: balance,
      status: "succeeded",
      provider: paymentMethod,
      providerRef: "",
    });
  }

  await scheduleReminders(sb, booking);
  try {
    await syncBookingToGoogle(sb, tech, booking);
  } catch {
    // Google Calendar sync is best-effort; booking creation remains source of truth.
  }
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
  addons = [],
  discountPennies = 0,
  pairedBookingId = null,
  riskTier = null,
  autoApproved = false,
}: BaseParams): Promise<Booking> {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + service.durationMin * 60 * 1000);
  const { price, deposit, balance } = resolveAmounts(
    service,
    tech,
    addons,
    discountPennies,
    riskTier,
  );

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
    approvalToken: null,
    pairedBookingId,
    riskTier,
    autoApproved,
    isPatchTest,
    notes,
    lashMap: "",
    lashCurl: "",
    lashLength: "",
    addons,
    discountPennies,
  });
}

/** Booking request awaiting tech approval before deposit or confirmation. */
export async function createPendingApprovalBooking({
  sb,
  tech,
  service,
  client,
  startIso,
  isPatchTest = false,
  notes = "",
  addons = [],
  discountPennies = 0,
  pairedBookingId = null,
  riskTier = null,
}: BaseParams): Promise<Booking> {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + service.durationMin * 60 * 1000);
  const { price, deposit, balance } = resolveAmounts(
    service,
    tech,
    addons,
    discountPennies,
    riskTier,
  );

  return createBooking(sb, {
    techId: tech.id,
    clientId: client.id,
    serviceId: service.id,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    status: "pending_approval",
    pricePennies: price,
    depositPennies: deposit,
    depositStatus: "none",
    balancePennies: balance,
    balanceStatus: balance > 0 ? "unpaid" : "paid",
    balanceToken: randomToken(),
    approvalToken: randomToken(),
    pairedBookingId,
    riskTier,
    autoApproved: false,
    isPatchTest,
    notes,
    lashMap: "",
    lashCurl: "",
    lashLength: "",
    addons,
    discountPennies,
  });
}

/** Tech approved a request — client pays deposit next, or booking confirms immediately. */
export async function approveBookingRequest(sb: SupabaseClient, booking: Booking): Promise<Booking> {
  if (booking.status !== "pending_approval") return booking;

  const { getClient, getService, getTechById } = await import("@/lib/db/queries");
  const { notifyClientBookingApproved } = await import("@/lib/notify");
  const [tech, service, client] = await Promise.all([
    getTechById(sb, booking.techId),
    getService(sb, booking.serviceId),
    getClient(sb, booking.clientId),
  ]);
  if (!tech || !service || !client) throw new Error("Booking data missing");

  const needsDeposit = booking.depositPennies > 0 && isPaymentsReady(tech);
  if (needsDeposit) {
    await updateBooking(sb, booking.id, { status: "pending", approvalToken: null });
    const updated = { ...booking, status: "pending" as const, approvalToken: null };
    await notifyClientBookingApproved(client, tech, service, updated);
    return updated;
  }

  await updateBooking(sb, booking.id, { status: "confirmed", approvalToken: null });
  const confirmed = { ...booking, status: "confirmed" as const, approvalToken: null };
  await scheduleReminders(sb, confirmed);
  try {
    await syncBookingToGoogle(sb, tech, confirmed);
  } catch {
    // Calendar sync is best-effort.
  }
  return confirmed;
}

/** Tech declined a booking request — slot is released. */
export async function declineBookingRequest(sb: SupabaseClient, booking: Booking): Promise<Booking> {
  if (booking.status !== "pending_approval") return booking;

  const { getClient, getService, getTechById } = await import("@/lib/db/queries");
  const { notifyClientBookingDeclined } = await import("@/lib/notify");
  const [tech, service, client] = await Promise.all([
    getTechById(sb, booking.techId),
    getService(sb, booking.serviceId),
    getClient(sb, booking.clientId),
  ]);

  await updateBooking(sb, booking.id, { status: "cancelled", approvalToken: null });
  const cancelled = { ...booking, status: "cancelled" as const, approvalToken: null };
  if (tech && service && client) {
    await notifyClientBookingDeclined(client, tech, service, cancelled);
  }
  return cancelled;
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
  const confirmed = { ...booking, status: "confirmed" as const, depositStatus: "paid" as const };
  await scheduleReminders(sb, confirmed);
  try {
    const { getTechById } = await import("@/lib/db/queries");
    await syncBookingToGoogle(sb, await getTechById(sb, booking.techId), confirmed);
  } catch {
    // Calendar sync is best-effort.
  }
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

/** After a reschedule: drop pending reminders and re-create the timed ones. */
export async function rescheduleReminders(sb: SupabaseClient, booking: Booking): Promise<void> {
  const { skipScheduledReminders } = await import("@/lib/db/queries");
  await skipScheduledReminders(sb, booking.id);
  try {
    const { reschedulePreCareConfirmation } = await import("@/lib/pre-care");
    const { getTechById } = await import("@/lib/db/queries");
    const tech = await getTechById(sb, booking.techId);
    if (tech) await reschedulePreCareConfirmation(sb, tech, booking);
  } catch {
    // Migration may be pending.
  }
  const startMs = new Date(booking.startIso).getTime();

  const remind24 = startMs - 24 * HOUR;
  if (remind24 > Date.now()) {
    await createReminder(sb, {
      techId: booking.techId,
      bookingId: booking.id,
      clientId: null,
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
      clientId: null,
      channel: "email",
      kind: "balance_request",
      sendAtIso: new Date(Math.max(balanceAt, Date.now())).toISOString(),
      status: "scheduled",
      preview: "",
      sentAtIso: null,
    });
  }
  try {
    const { getTechById } = await import("@/lib/db/queries");
    await syncBookingToGoogle(sb, await getTechById(sb, booking.techId), booking);
  } catch {
    // Calendar sync is best-effort.
  }
}

export async function scheduleReminders(sb: SupabaseClient, booking: Booking): Promise<void> {
  const startMs = new Date(booking.startIso).getTime();

  const confirmation = await createReminder(sb, {
    techId: booking.techId,
    bookingId: booking.id,
    clientId: null,
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
      clientId: null,
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
      clientId: null,
      channel: "email",
      kind: "balance_request",
      sendAtIso: new Date(Math.max(balanceAt, Date.now())).toISOString(),
      status: "scheduled",
      preview: "",
      sentAtIso: null,
    });
  }
  try {
    const { schedulePreCareConfirmation } = await import("@/lib/pre-care");
    const { getTechById } = await import("@/lib/db/queries");
    const tech = await getTechById(sb, booking.techId);
    if (tech) await schedulePreCareConfirmation(sb, tech, booking);
  } catch {
    // Migration may be pending.
  }
}

export type PairedBookingResult = {
  patchBooking: Booking;
};

/** Create the patch-test half of a paired booking (always confirmed). */
export async function createPairedPatchTestBooking({
  sb,
  tech,
  client,
  treatmentService,
  patchTestService,
  category,
  patchSlotIso,
}: {
  sb: SupabaseClient;
  tech: Tech;
  client: Client;
  treatmentService: Service;
  patchTestService: Service;
  category: { patchTestValidityDays: number } | null;
  patchSlotIso: string;
}): Promise<Booking> {
  const { createPatchTest } = await import("@/lib/db/queries");
  const { markRetestsTestBooked } = await import("@/lib/product-change");

  const patchBooking = await createConfirmedBooking({
    sb,
    tech,
    service: patchTestService,
    client,
    startIso: patchSlotIso,
    isPatchTest: true,
    notes: "Patch test booked online with treatment",
    addons: [],
    discountPennies: 0,
  });

  const performed = new Date(patchSlotIso);
  const expires = new Date(
    performed.getTime() + (category?.patchTestValidityDays ?? 180) * 24 * 60 * 60 * 1000,
  );
  const patchTest = await createPatchTest(sb, {
    techId: tech.id,
    clientId: client.id,
    categoryId: treatmentService.categoryId,
    performedAtIso: performed.toISOString(),
    expiresAtIso: expires.toISOString(),
    result: "pending",
    bookingId: patchBooking.id,
    notes: "Booked online",
    invalidatedAtIso: null,
    invalidationEventId: null,
  });

  try {
    const { scheduleReactionCheckin } = await import("@/lib/reaction-checkin");
    await scheduleReactionCheckin(sb, {
      techId: tech.id,
      clientId: client.id,
      categoryId: treatmentService.categoryId,
      anchorIso: patchSlotIso,
      patchTestId: patchTest.id,
      bookingId: patchBooking.id,
    });
  } catch {
    // Best-effort if migration pending.
  }

  await markRetestsTestBooked(sb, tech.id, client.id, treatmentService.categoryId);

  return patchBooking;
}

export async function linkPairedBookings(
  sb: SupabaseClient,
  patchBookingId: string,
  treatmentBookingId: string,
): Promise<void> {
  await updateBooking(sb, patchBookingId, { pairedBookingId: treatmentBookingId });
  await updateBooking(sb, treatmentBookingId, { pairedBookingId: patchBookingId });
}
