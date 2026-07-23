import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createBooking,
  createPayment,
  createReminder,
  listBookingsByGroup,
  updateBooking,
} from "@/lib/db/queries";
import { depositFor, bookingAmounts, basketAmounts, basketStartTimes } from "@/lib/rules";
import { sendReminder } from "@/lib/notify";
import { randomId, randomToken } from "@/lib/ids";
import { syncBookingToGoogle } from "@/lib/google-calendar";
import type { Booking, BookingAddon, Client, RiskTier, Service, Tech } from "@/lib/db/types";
import { isPaymentsReady, usesCardCapture } from "@/lib/subscriptions";

const HOUR = 60 * 60 * 1000;

interface BaseParams {
  sb: SupabaseClient;
  tech: Tech;
  service: Service;
  client: Client;
  startIso: string;
  /** Staff member taking the appointment (salon mode). */
  staffId?: string | null;
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
  staffId = null,
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
  allowOverlap = false,
}: BaseParams & {
  paymentTaken?: ManualPaymentTaken;
  paymentMethod?: string;
  depositOverridePennies?: number | null;
  allowOverlap?: boolean;
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
    staffId,
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
    ...(allowOverlap ? { allowOverlap: true } : {}),
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

/** Pending booking awaiting an online deposit payment or card capture (confirmed once done). */
export async function createPendingOnlineBooking({
  sb,
  tech,
  service,
  client,
  startIso,
  staffId = null,
  isPatchTest = false,
  notes = "",
  addons = [],
  discountPennies = 0,
  pairedBookingId = null,
  riskTier = null,
  autoApproved = false,
  depositOverridePennies = null,
}: BaseParams): Promise<Booking> {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + service.durationMin * 60 * 1000);
  const { price, deposit, balance } = resolveAmounts(
    service,
    tech,
    addons,
    discountPennies,
    riskTier,
    depositOverridePennies,
  );

  return createBooking(sb, {
    techId: tech.id,
    clientId: client.id,
    serviceId: service.id,
    staffId,
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
  staffId = null,
  isPatchTest = false,
  notes = "",
  addons = [],
  discountPennies = 0,
  pairedBookingId = null,
  riskTier = null,
  depositOverridePennies = null,
}: BaseParams): Promise<Booking> {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + service.durationMin * 60 * 1000);
  const { price, deposit, balance } = resolveAmounts(
    service,
    tech,
    addons,
    discountPennies,
    riskTier,
    depositOverridePennies,
  );

  return createBooking(sb, {
    techId: tech.id,
    clientId: client.id,
    serviceId: service.id,
    staffId,
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

/** Tech approved a request — client pays deposit / saves a card next, or booking confirms immediately. */
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

  // Card capture mode: the client saves a card (via the booked page) before
  // the booking confirms, mirroring the deposit path.
  const needsCard = usesCardCapture(tech) && !booking.cardPaymentMethodId;
  const needsDeposit = (booking.depositPennies > 0 && isPaymentsReady(tech)) || needsCard;
  if (needsDeposit) {
    await updateBooking(sb, booking.id, { status: "pending", approvalToken: null });
    await propagateGroupStatus(sb, booking, "pending");
    const updated = { ...booking, status: "pending" as const, approvalToken: null };
    await notifyClientBookingApproved(client, tech, service, updated);
    // Salon notify waits until checkout.session.completed confirms the booking.
    return updated;
  }

  await updateBooking(sb, booking.id, { status: "confirmed", approvalToken: null });
  await propagateGroupStatus(sb, booking, "confirmed");
  const confirmed = { ...booking, status: "confirmed" as const, approvalToken: null };
  await scheduleReminders(sb, confirmed);
  try {
    await syncBookingToGoogle(sb, tech, confirmed);
  } catch {
    // Calendar sync is best-effort.
  }
  try {
    const { notifySalonOfNewBooking } = await import("@/lib/notify");
    await notifySalonOfNewBooking(sb, confirmed);
  } catch {
    // Notify is best-effort.
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
  await propagateGroupStatus(sb, booking, "cancelled");
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
  // Never resurrect a cancelled booking if cancel_url raced the webhook.
  if (booking.status === "cancelled" || booking.status === "no_show") return;
  if (booking.depositStatus === "paid") return;
  const priorStatus = booking.status;
  try {
    await createPayment(sb, {
      techId: booking.techId,
      bookingId: booking.id,
      kind: "deposit",
      amountPennies: booking.depositPennies,
      status: "succeeded",
      provider: "stripe",
      providerRef: paymentIntentId,
    });
  } catch (e) {
    const { isUniqueViolation } = await import("@/lib/db/errors");
    if (!isUniqueViolation(e)) throw e;
    // Duplicate Stripe payment row — treat as already processed.
  }
  await updateBooking(sb, booking.id, { status: "confirmed", depositStatus: "paid" });
  await propagateGroupStatus(sb, booking, "confirmed");
  const confirmed = { ...booking, status: "confirmed" as const, depositStatus: "paid" as const };
  await scheduleReminders(sb, confirmed);
  try {
    const { getTechById } = await import("@/lib/db/queries");
    const tech = await getTechById(sb, booking.techId);
    await syncBookingToGoogle(sb, tech, confirmed);
    if (booking.groupId && tech) {
      for (const b of await listBookingsByGroup(sb, booking.groupId)) {
        if (b.id !== booking.id) await syncBookingToGoogle(sb, tech, { ...b, status: "confirmed" });
      }
    }
  } catch {
    // Calendar sync is best-effort.
  }
  // Notify only when checkout succeeds (pending → confirmed), never on abandoned holds.
  if (priorStatus === "pending" || priorStatus === "pending_approval") {
    try {
      const { notifySalonOfNewBooking } = await import("@/lib/notify");
      await notifySalonOfNewBooking(sb, confirmed);
    } catch {
      // Notify is best-effort.
    }
  }
  try {
    const { revalidatePublicAvailability } = await import("@/lib/booking/public-availability-cache");
    revalidatePublicAvailability(booking.techId);
  } catch {
    // Cache bust is best-effort.
  }
}

/** Card saved for no-show cover (idempotent): confirm the booking + schedule reminders. */
export async function applyCardCaptured(
  sb: SupabaseClient,
  booking: Booking,
  customerId: string,
  paymentMethodId: string,
): Promise<void> {
  if (booking.status === "cancelled" || booking.status === "no_show") return;
  if (booking.cardPaymentMethodId) return;
  const priorStatus = booking.status;
  await updateBooking(sb, booking.id, {
    status: "confirmed",
    cardCustomerId: customerId,
    cardPaymentMethodId: paymentMethodId,
  });
  await propagateGroupStatus(sb, booking, "confirmed");
  const confirmed = {
    ...booking,
    status: "confirmed" as const,
    cardCustomerId: customerId,
    cardPaymentMethodId: paymentMethodId,
  };
  await scheduleReminders(sb, confirmed);
  try {
    const { getTechById } = await import("@/lib/db/queries");
    const tech = await getTechById(sb, booking.techId);
    await syncBookingToGoogle(sb, tech, confirmed);
    if (booking.groupId && tech) {
      for (const b of await listBookingsByGroup(sb, booking.groupId)) {
        if (b.id !== booking.id) await syncBookingToGoogle(sb, tech, { ...b, status: "confirmed" });
      }
    }
  } catch {
    // Calendar sync is best-effort.
  }
  if (priorStatus === "pending" || priorStatus === "pending_approval") {
    try {
      const { notifySalonOfNewBooking } = await import("@/lib/notify");
      await notifySalonOfNewBooking(sb, confirmed);
    } catch {
      // Notify is best-effort.
    }
  }
  try {
    const { revalidatePublicAvailability } = await import("@/lib/booking/public-availability-cache");
    revalidatePublicAvailability(booking.techId);
  } catch {
    // Cache bust is best-effort.
  }
}

/**
 * Cancel a pending checkout hold when the client abandons Stripe (cancel_url or
 * session expired). Idempotent and safe if the webhook already confirmed.
 * Returns true when the booking was cancelled.
 */
export async function releaseAbandonedCheckoutBooking(
  sb: SupabaseClient,
  booking: Booking,
): Promise<boolean> {
  const { getBooking, paymentsForBooking } = await import("@/lib/db/queries");
  const fresh = await getBooking(sb, booking.id);
  if (!fresh) return false;
  if (fresh.status !== "pending") return false;
  if (fresh.cardPaymentMethodId) return false;
  if (fresh.depositStatus === "paid") return false;

  const payments = await paymentsForBooking(sb, fresh.id);
  if (
    payments.some(
      (p) => p.status === "succeeded" && (p.kind === "deposit" || p.kind === "balance"),
    )
  ) {
    return false;
  }

  if (fresh.groupId) {
    const group = await listBookingsByGroup(sb, fresh.groupId);
    for (const b of group) {
      if (b.status === "cancelled" || b.status === "completed" || b.status === "no_show") continue;
      await updateBooking(sb, b.id, { status: "cancelled" });
    }
  } else {
    await updateBooking(sb, fresh.id, { status: "cancelled" });
    if (fresh.pairedBookingId) {
      await updateBooking(sb, fresh.pairedBookingId, { status: "cancelled" }).catch(() => undefined);
    }
  }

  try {
    const { revalidatePublicAvailability } = await import("@/lib/booking/public-availability-cache");
    revalidatePublicAvailability(fresh.techId);
  } catch {
    // Cache bust is best-effort.
  }
  return true;
}

/** True when a Checkout session is a public booking deposit or card-capture hold. */
export function isBookingCheckoutSession(session: {
  metadata?: Record<string, string> | null;
}): boolean {
  const kind = session.metadata?.kind;
  return !!session.metadata?.bookingId && (kind === "deposit" || kind === "card_capture");
}

/**
 * Confirm a booking from checkout.session.completed (Connect deposit payment or
 * card-capture setup). Idempotent with the success-page return path.
 */
export async function completeBookingCheckoutFromSession(
  sb: SupabaseClient,
  session: {
    metadata?: Record<string, string> | null;
    mode?: string | null;
    status?: string | null;
    payment_status?: string | null;
    payment_intent?: string | { id?: string } | null;
    setup_intent?: string | { id?: string } | null;
    customer?: string | { id?: string } | null;
  },
): Promise<void> {
  if (!isBookingCheckoutSession(session)) return;
  const bookingId = session.metadata!.bookingId!;
  const kind = session.metadata!.kind!;

  const { getBooking, getTechById } = await import("@/lib/db/queries");
  const booking = await getBooking(sb, bookingId);
  if (!booking) return;
  if (booking.status === "cancelled" || booking.status === "no_show") return;

  if (kind === "deposit") {
    if (session.payment_status !== "paid") return;
    const pi =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? "";
    if (!pi) return;
    await applyDepositPaid(sb, booking, pi);
    return;
  }

  // card_capture setup mode
  if (session.mode !== "setup" || session.status !== "complete") return;
  const tech = await getTechById(sb, booking.techId);
  if (!tech?.stripeConnectAccountId) return;
  const setupIntentId =
    typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent?.id;
  if (!setupIntentId) return;

  const { stripe } = await import("@/lib/stripe");
  const s = stripe();
  const si = await s.setupIntents.retrieve(setupIntentId, undefined, {
    stripeAccount: tech.stripeConnectAccountId,
  });
  const paymentMethodId =
    typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id ?? "";
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? "";
  if (!paymentMethodId || !customerId) return;
  await applyCardCaptured(sb, booking, customerId, paymentMethodId);
}

/** Release a pending hold when checkout.session.expired fires. */
export async function expireBookingCheckoutFromSession(
  sb: SupabaseClient,
  session: { metadata?: Record<string, string> | null },
): Promise<void> {
  if (!isBookingCheckoutSession(session)) return;
  const { getBooking } = await import("@/lib/db/queries");
  const booking = await getBooking(sb, session.metadata!.bookingId!);
  if (!booking) return;
  await releaseAbandonedCheckoutBooking(sb, booking);
}

/** Mark a balance paid (idempotent). */
export async function applyBalancePaid(
  sb: SupabaseClient,
  booking: Booking,
  paymentIntentId: string,
): Promise<void> {
  if (booking.balanceStatus === "paid") return;
  try {
    await createPayment(sb, {
      techId: booking.techId,
      bookingId: booking.id,
      kind: "balance",
      amountPennies: booking.balancePennies,
      status: "succeeded",
      provider: "stripe",
      providerRef: paymentIntentId,
    });
  } catch (e) {
    const { isUniqueViolation } = await import("@/lib/db/errors");
    if (!isUniqueViolation(e)) throw e;
    // Duplicate Stripe payment row — treat as already processed.
  }
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
    if (await balanceEmailsOnFor(sb, booking.techId)) {
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
  }
  try {
    const { getTechById } = await import("@/lib/db/queries");
    await syncBookingToGoogle(sb, await getTechById(sb, booking.techId), booking);
  } catch {
    // Calendar sync is best-effort.
  }
}

/** Whether this account wants "pay your balance" emails (Settings toggle). */
async function balanceEmailsOnFor(sb: SupabaseClient, techId: string): Promise<boolean> {
  try {
    const { sendsBalanceEmails } = await import("@/lib/subscriptions");
    const { getTechById } = await import("@/lib/db/queries");
    return sendsBalanceEmails(await getTechById(sb, techId));
  } catch {
    return true;
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
    if (await balanceEmailsOnFor(sb, booking.techId)) {
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

// ---------------- Basket (multiple treatments, one visit) ----------------

/**
 * Create back-to-back bookings for a basket of treatments. All money (price,
 * deposit, balance) lives on the PRIMARY (first) booking so there is exactly
 * one deposit checkout, one balance link and one payment ledger trail per
 * visit; the other treatments are £0 line items with their own diary slots.
 */
export async function createBasketBookings({
  sb,
  tech,
  services,
  client,
  startIso,
  status,
  staffId = null,
  addons = [],
  discountPennies = 0,
  riskTier = null,
  autoApproved = false,
  depositOverridePennies = null,
  paymentTaken = "none",
  paymentMethod = "in_person",
  allowOverlap = false,
}: {
  sb: SupabaseClient;
  tech: Tech;
  services: Service[];
  client: Client;
  startIso: string;
  status: "confirmed" | "pending" | "pending_approval";
  staffId?: string | null;
  addons?: BookingAddon[];
  discountPennies?: number;
  riskTier?: RiskTier | null;
  autoApproved?: boolean;
  depositOverridePennies?: number | null;
  /** Offline payment already taken (manual bookings). */
  paymentTaken?: ManualPaymentTaken;
  paymentMethod?: string;
  allowOverlap?: boolean;
}): Promise<{ primary: Booking; all: Booking[] }> {
  if (services.length < 2) throw new Error("Basket needs at least two treatments");

  const groupId = randomId("grp");

  // Online baskets pass a risk tier. Manual bookings use plain service deposits.
  let money =
    riskTier != null
      ? basketAmounts(services, tech, riskTier, addons, discountPennies)
      : (() => {
          const extras = addons.reduce((s, a) => s + a.pricePennies, 0);
          const price = Math.max(
            0,
            services.reduce((s, svc) => s + svc.pricePennies, 0) + extras - discountPennies,
          );
          const deposit = Math.min(
            services.reduce((s, svc) => s + depositFor(svc), 0),
            price,
          );
          return { price, deposit, balance: Math.max(0, price - deposit) };
        })();

  if (depositOverridePennies != null) {
    const deposit = Math.min(Math.max(0, depositOverridePennies), money.price);
    money = { ...money, deposit, balance: Math.max(0, money.price - deposit) };
  }

  const depositPaid = status === "confirmed" && paymentTaken !== "none" && money.deposit > 0;
  const fullyPaid = status === "confirmed" && paymentTaken === "full";
  const primaryDepositStatus = depositPaid ? "paid" : "none";
  const primaryBalanceStatus = fullyPaid || money.balance === 0 ? "paid" : "unpaid";

  const starts = basketStartTimes(services, startIso);
  const created: Booking[] = [];

  try {
    for (let i = 0; i < services.length; i++) {
      const service = services[i];
      const start = new Date(starts[i]);
      const end = new Date(start.getTime() + service.durationMin * 60 * 1000);
      const isPrimary = i === 0;
      const booking = await createBooking(sb, {
        techId: tech.id,
        clientId: client.id,
        serviceId: service.id,
        staffId,
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        status,
        pricePennies: isPrimary ? money.price : 0,
        depositPennies: isPrimary ? money.deposit : 0,
        depositStatus: isPrimary ? primaryDepositStatus : "none",
        balancePennies: isPrimary ? money.balance : 0,
        balanceStatus: isPrimary ? primaryBalanceStatus : "paid",
        balanceToken: randomToken(),
        approvalToken: isPrimary && status === "pending_approval" ? randomToken() : null,
        pairedBookingId: null,
        groupId,
        riskTier,
        autoApproved,
        isPatchTest: false,
        notes: isPrimary
          ? `Booked with ${services.length - 1} more treatment${services.length > 2 ? "s" : ""} in one visit`
          : "Part of a multi-treatment visit (paid on the first booking)",
        lashMap: "",
        lashCurl: "",
        lashLength: "",
        addons: isPrimary ? addons : [],
        discountPennies: isPrimary ? discountPennies : 0,
        ...(allowOverlap ? { allowOverlap: true } : {}),
      });
      created.push(booking);
    }
  } catch (e) {
    // A later slot in the chain was taken mid-flow: release what we created.
    for (const b of created) {
      try {
        await updateBooking(sb, b.id, { status: "cancelled" });
      } catch {
        // Best-effort rollback.
      }
    }
    throw e;
  }

  const primary = created[0];

  if (depositPaid) {
    await createPayment(sb, {
      techId: tech.id,
      bookingId: primary.id,
      kind: "deposit",
      amountPennies: money.deposit,
      status: "succeeded",
      provider: paymentMethod,
      providerRef: "",
    });
  }
  if (fullyPaid && money.balance > 0) {
    await createPayment(sb, {
      techId: tech.id,
      bookingId: primary.id,
      kind: "balance",
      amountPennies: money.balance,
      status: "succeeded",
      provider: paymentMethod,
      providerRef: "",
    });
  }

  if (status === "confirmed") {
    await scheduleReminders(sb, primary);
    for (const b of created) {
      try {
        await syncBookingToGoogle(sb, tech, b);
      } catch {
        // Calendar sync is best-effort.
      }
    }
  }

  return { primary, all: created };
}

/** Move every booking in a basket group to the given status (skips settled ones). */
export async function propagateGroupStatus(
  sb: SupabaseClient,
  booking: Booking,
  status: Booking["status"],
): Promise<void> {
  if (!booking.groupId) return;
  const group = await listBookingsByGroup(sb, booking.groupId);
  for (const b of group) {
    if (b.id === booking.id) continue;
    if (b.status === "completed" || b.status === "cancelled" || b.status === "no_show") continue;
    await updateBooking(sb, b.id, { status });
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
  staffId = null,
}: {
  sb: SupabaseClient;
  tech: Tech;
  client: Client;
  treatmentService: Service;
  patchTestService: Service;
  category: { patchTestValidityDays: number } | null;
  patchSlotIso: string;
  staffId?: string | null;
}): Promise<Booking> {
  const { createPatchTest } = await import("@/lib/db/queries");
  const { markRetestsTestBooked } = await import("@/lib/product-change");

  const patchBooking = await createConfirmedBooking({
    sb,
    tech,
    service: patchTestService,
    client,
    startIso: patchSlotIso,
    staffId,
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
