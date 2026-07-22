import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeBooking, makeTech } from "./fixtures";
import { BOOKING_CHECKOUT_EXPIRES_SECONDS } from "@/lib/payments";

const getBooking = vi.fn();
const paymentsForBooking = vi.fn(async () => [] as { status: string; kind: string }[]);
const updateBooking = vi.fn(async () => undefined);
const listBookingsByGroup = vi.fn(async () => [] as ReturnType<typeof makeBooking>[]);
const createPayment = vi.fn(async () => undefined);
const getTechById = vi.fn();
const notifySalonOfNewBooking = vi.fn(async () => undefined);
const revalidatePublicAvailability = vi.fn();
const setupIntentsRetrieve = vi.fn();

vi.mock("@/lib/db/queries", () => ({
  getBooking,
  paymentsForBooking,
  updateBooking,
  listBookingsByGroup,
  createPayment,
  getTechById,
  createReminder: vi.fn(async () => undefined),
  skipScheduledReminders: vi.fn(async () => undefined),
}));

vi.mock("@/lib/notify", () => ({
  notifySalonOfNewBooking,
  sendReminder: vi.fn(async () => true),
}));

vi.mock("@/lib/booking/public-availability-cache", () => ({
  revalidatePublicAvailability,
}));

vi.mock("@/lib/google-calendar", () => ({
  syncBookingToGoogle: vi.fn(async () => undefined),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: () => ({
    setupIntents: {
      retrieve: (...args: unknown[]) => setupIntentsRetrieve(...args),
    },
  }),
}));

describe("abandoned Stripe Checkout cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    paymentsForBooking.mockResolvedValue([]);
  });

  it("cancel_url release cancels a pending deposit hold and does not notify", async () => {
    const pending = makeBooking({
      id: "bk_pending",
      status: "pending",
      depositStatus: "none",
      depositPennies: 1500,
      cardPaymentMethodId: null,
    });
    getBooking.mockResolvedValue(pending);

    const { releaseAbandonedCheckoutBooking } = await import("@/lib/bookings");
    const released = await releaseAbandonedCheckoutBooking({} as never, pending);

    expect(released).toBe(true);
    expect(updateBooking).toHaveBeenCalledWith(
      expect.anything(),
      "bk_pending",
      expect.objectContaining({ status: "cancelled" }),
    );
    expect(notifySalonOfNewBooking).not.toHaveBeenCalled();
    expect(revalidatePublicAvailability).toHaveBeenCalledWith(pending.techId);
  });

  it("cancel_url after successful completion does not cancel", async () => {
    const confirmed = makeBooking({
      id: "bk_done",
      status: "confirmed",
      depositStatus: "paid",
      depositPennies: 1500,
    });
    getBooking.mockResolvedValue(confirmed);

    const { releaseAbandonedCheckoutBooking } = await import("@/lib/bookings");
    const released = await releaseAbandonedCheckoutBooking({} as never, confirmed);

    expect(released).toBe(false);
    expect(updateBooking).not.toHaveBeenCalled();
    expect(notifySalonOfNewBooking).not.toHaveBeenCalled();
  });

  it("completing deposit checkout confirms once and notifies exactly once", async () => {
    const pending = makeBooking({
      id: "bk_dep",
      status: "pending",
      depositStatus: "none",
      depositPennies: 1500,
    });
    getBooking.mockResolvedValue(pending);
    getTechById.mockResolvedValue(makeTech({ id: pending.techId }));

    const { completeBookingCheckoutFromSession, applyDepositPaid } = await import("@/lib/bookings");

    await completeBookingCheckoutFromSession({} as never, {
      metadata: { bookingId: "bk_dep", kind: "deposit" },
      mode: "payment",
      payment_status: "paid",
      payment_intent: "pi_1",
    });

    expect(createPayment).toHaveBeenCalledOnce();
    expect(updateBooking).toHaveBeenCalledWith(
      expect.anything(),
      "bk_dep",
      expect.objectContaining({ status: "confirmed", depositStatus: "paid" }),
    );
    expect(notifySalonOfNewBooking).toHaveBeenCalledOnce();

    // Success-page retry / second webhook: already paid → no second notify.
    notifySalonOfNewBooking.mockClear();
    updateBooking.mockClear();
    createPayment.mockClear();
    const paid = { ...pending, status: "confirmed" as const, depositStatus: "paid" as const };
    await applyDepositPaid({} as never, paid, "pi_1");
    expect(notifySalonOfNewBooking).not.toHaveBeenCalled();
    expect(updateBooking).not.toHaveBeenCalled();
  });

  it("completing card-capture checkout confirms and notifies exactly once", async () => {
    const pending = makeBooking({
      id: "bk_card",
      status: "pending",
      depositPennies: 0,
      depositStatus: "none",
      cardPaymentMethodId: null,
    });
    getBooking.mockResolvedValue(pending);
    getTechById.mockResolvedValue(
      makeTech({ id: pending.techId, stripeConnectAccountId: "acct_1" }),
    );
    setupIntentsRetrieve.mockResolvedValue({ payment_method: "pm_1" });

    const { completeBookingCheckoutFromSession } = await import("@/lib/bookings");
    await completeBookingCheckoutFromSession({} as never, {
      metadata: { bookingId: "bk_card", kind: "card_capture" },
      mode: "setup",
      status: "complete",
      setup_intent: "seti_1",
      customer: "cus_1",
    });

    expect(updateBooking).toHaveBeenCalledWith(
      expect.anything(),
      "bk_card",
      expect.objectContaining({
        status: "confirmed",
        cardCustomerId: "cus_1",
        cardPaymentMethodId: "pm_1",
      }),
    );
    expect(notifySalonOfNewBooking).toHaveBeenCalledOnce();
  });

  it("expired session releases a pending booking", async () => {
    const pending = makeBooking({
      id: "bk_exp",
      status: "pending",
      depositStatus: "none",
      cardPaymentMethodId: null,
    });
    getBooking.mockResolvedValue(pending);

    const { expireBookingCheckoutFromSession } = await import("@/lib/bookings");
    await expireBookingCheckoutFromSession({} as never, {
      metadata: { bookingId: "bk_exp", kind: "deposit" },
    });

    expect(updateBooking).toHaveBeenCalledWith(
      expect.anything(),
      "bk_exp",
      expect.objectContaining({ status: "cancelled" }),
    );
    expect(notifySalonOfNewBooking).not.toHaveBeenCalled();
  });

  it("deposit and card-capture Checkout builders set cancel_url + 30m expiry", async () => {
    // Covered in card-capture-checkout.test.ts against the real builders.
    expect(BOOKING_CHECKOUT_EXPIRES_SECONDS).toBe(30 * 60);
    const paymentsSrc = await import("node:fs").then((fs) =>
      fs.promises.readFile("lib/payments.ts", "utf8"),
    );
    expect(paymentsSrc).toContain("checkout-cancel/${booking.balanceToken}");
    expect(paymentsSrc).toContain("expires_at: bookingCheckoutExpiresAt()");
    expect(paymentsSrc).toMatch(/kind: "deposit"/);
    expect(paymentsSrc).toMatch(/kind: "card_capture"/);
  });

  it("cancelled bookings are excluded from the public blocking statuses", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.promises.readFile("lib/db/queries.ts", "utf8"),
    );
    const start = src.indexOf("export async function listBlockingBookingsInRange");
    const end = src.indexOf("export async function listBookingsInWindow", start);
    const fn = src.slice(start, end);
    expect(fn).toMatch(/\.in\("status", \["pending_approval", "pending", "confirmed", "completed"\]\)/);
    expect(fn).not.toMatch(/"cancelled"/);
  });
});
