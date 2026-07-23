import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeBooking, makeClient, makeService, makeTech } from "./fixtures";

const sendEmail = vi.fn(async () => true);
const getClient = vi.fn();
const getService = vi.fn();
const getTechById = vi.fn();
const getStaff = vi.fn(async () => null);
const listBookingsByGroup = vi.fn(async () => []);

vi.mock("@/lib/db/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/queries")>();
  return {
    ...actual,
    getClient,
    getService,
    getTechById,
    getStaff,
    listBookingsByGroup,
  };
});

vi.mock("@/lib/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email")>();
  return {
    ...actual,
    sendEmail,
    brandedEmail: actual.brandedEmail,
  };
});

describe("cancellationAdvanceLabel / cancellationMoneyStatus", () => {
  it("describes how far ahead the cancel happened", async () => {
    const { cancellationAdvanceLabel } = await import("@/lib/notify");
    expect(cancellationAdvanceLabel(72)).toBe("cancelled 3 days before");
    expect(cancellationAdvanceLabel(48)).toBe("cancelled 2 days before");
    expect(cancellationAdvanceLabel(2)).toBe("cancelled 2 hours before");
    expect(cancellationAdvanceLabel(0.5)).toBe("cancelled less than an hour before");
  });

  it("covers deposit refunded, retained, and card-on-file no charge", async () => {
    const { cancellationMoneyStatus } = await import("@/lib/notify");

    expect(
      cancellationMoneyStatus({
        depositPennies: 1500,
        depositStatus: "refunded",
      }),
    ).toContain("refunded");

    expect(
      cancellationMoneyStatus({
        depositPennies: 1500,
        depositStatus: "forfeited",
      }),
    ).toContain("retained");

    expect(
      cancellationMoneyStatus({
        depositPennies: 0,
        depositStatus: "none",
        cardPaymentMethodId: "pm_1",
        cardCharge: null,
      }),
    ).toMatch(/Card on file \(nothing charged\)/);
  });
});

describe("notifySalonOfCancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClient.mockResolvedValue(makeClient({ name: "Sophie Turner" }));
    getService.mockResolvedValue(makeService({ name: "Classic Full Set" }));
    getTechById.mockResolvedValue(
      makeTech({
        email: "tech@glow-uk.com",
        bookingNotifyEmailEnabled: true,
        stripeConnectAccountId: "acct_1",
      }),
    );
    getStaff.mockResolvedValue(null);
  });

  it("sends exactly one email with subject and money status for deposit refunded", async () => {
    const { notifySalonOfCancellation } = await import("@/lib/notify");
    const booking = makeBooking({
      status: "cancelled",
      depositPennies: 1500,
      depositStatus: "refunded",
      startIso: "2026-08-01T10:00:00.000Z",
      endIso: "2026-08-01T11:00:00.000Z",
    });

    await notifySalonOfCancellation({} as never, booking, { hoursOut: 72 });

    expect(sendEmail).toHaveBeenCalledOnce();
    const call = sendEmail.mock.calls[0][0];
    expect(call.to).toBe("tech@glow-uk.com");
    expect(call.subject).toMatch(/^Cancelled: Sophie Turner — Classic Full Set,/);
    expect(call.kind).toBe("booking_cancel_notify");
    expect(call.techId).toBe("tech_1");
    expect(call.idempotencyKey).toContain("booking-cancel-notify/");
    expect(call.html).toContain("refunded");
    expect(call.html).toContain("cancelled 3 days before");
    expect(call.text).toContain("refunded");
  });

  it("includes retained deposit wording for late cancel", async () => {
    const { notifySalonOfCancellation } = await import("@/lib/notify");
    const booking = makeBooking({
      status: "cancelled",
      depositPennies: 1500,
      depositStatus: "forfeited",
      startIso: "2026-08-01T10:00:00.000Z",
    });

    await notifySalonOfCancellation({} as never, booking, { hoursOut: 2 });

    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0][0].html).toContain("retained");
    expect(sendEmail.mock.calls[0][0].html).toContain("cancelled 2 hours before");
  });

  it("includes card-on-file no charge when nothing was taken", async () => {
    const { notifySalonOfCancellation } = await import("@/lib/notify");
    const booking = makeBooking({
      status: "cancelled",
      depositPennies: 0,
      depositStatus: "none",
      cardPaymentMethodId: "pm_saved",
      startIso: "2026-08-01T10:00:00.000Z",
    });

    await notifySalonOfCancellation({} as never, booking, {
      hoursOut: 72,
      cardCharge: { outcome: "skipped", amountPennies: 0 },
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0][0].html).toMatch(/Card on file \(nothing charged\)/);
  });

  it("skips invalid tech emails", async () => {
    getTechById.mockResolvedValue(
      makeTech({ email: "not-an-email", bookingNotifyEmailEnabled: true }),
    );
    const { notifySalonOfCancellation } = await import("@/lib/notify");
    await notifySalonOfCancellation(
      {} as never,
      makeBooking({ status: "cancelled", depositStatus: "refunded" }),
      { hoursOut: 72 },
    );
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("cancelClientBookingAction notifies salon", () => {
  const getTechByHandle = vi.fn();
  const getBookingByToken = vi.fn();
  const updateBooking = vi.fn(async () => undefined);
  const paymentsForBooking = vi.fn(async () => []);
  const createAuditEvent = vi.fn(async () => undefined);
  const createPayment = vi.fn(async () => undefined);
  const skipScheduledReminders = vi.fn(async () => undefined);
  const notifySalonOfCancellation = vi.fn(async () => undefined);
  const notifyWaitlistForCancelledBooking = vi.fn(async () => undefined);
  const chargeCardProtectionFee = vi.fn(async () => ({
    outcome: "skipped" as const,
    amountPennies: 0,
    reason: "no_saved_card",
  }));
  const redirect = vi.fn((url: string) => {
    const err = new Error("NEXT_REDIRECT");
    (err as { digest?: string }).digest = `NEXT_REDIRECT;${url}`;
    throw err;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    getClient.mockResolvedValue(makeClient());
    getService.mockResolvedValue(makeService());
  });

  async function loadAction() {
    vi.doMock("@/lib/supabase/service", () => ({
      supabaseService: () => ({}),
    }));
    vi.doMock("@/lib/db/queries", () => ({
      getTechByHandle,
      getBookingByToken,
      updateBooking,
      paymentsForBooking,
      createAuditEvent,
      createPayment,
      skipScheduledReminders,
      listBookingsByGroup: vi.fn(async () => []),
      getClient,
      getService,
      getTechById,
    }));
    vi.doMock("@/lib/google-calendar", () => ({
      syncBookingToGoogle: vi.fn(async () => undefined),
    }));
    vi.doMock("@/lib/booking/public-availability-cache", () => ({
      revalidatePublicAvailability: vi.fn(),
    }));
    vi.doMock("@/lib/waitlist", () => ({
      notifyWaitlistForCancelledBooking,
    }));
    vi.doMock("@/lib/notify", () => ({
      notifySalonOfCancellation,
      cancellationAdvanceLabel: (h: number) => `advance:${h}`,
      cancellationMoneyStatus: () => "money status",
    }));
    vi.doMock("@/lib/card-protection", () => ({
      chargeCardProtectionFee,
    }));
    vi.doMock("@/lib/payments", () => ({
      refundOnConnect: vi.fn(async () => undefined),
      createDepositCheckout: vi.fn(),
      createCardCaptureCheckout: vi.fn(),
    }));
    vi.doMock("next/navigation", () => ({ redirect }));
    return import("@/app/[handle]/booked/[token]/actions");
  }

  it("notifies on client cancel of a confirmed booking", async () => {
    const tech = makeTech({
      handle: "bellarose",
      cancellationWindowHours: 48,
      stripeConnectAccountId: "acct_1",
    });
    const start = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const booking = makeBooking({
      id: "bk_conf",
      status: "confirmed",
      depositStatus: "paid",
      depositPennies: 1500,
      startIso: start,
      endIso: new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString(),
      balanceToken: "tok_cancel",
    });
    getTechByHandle.mockResolvedValue(tech);
    getBookingByToken.mockResolvedValue(booking);

    const { cancelClientBookingAction } = await loadAction();
    const fd = new FormData();
    fd.set("handle", "bellarose");
    fd.set("token", "tok_cancel");
    await expect(cancelClientBookingAction(fd)).rejects.toThrow("NEXT_REDIRECT");

    expect(notifySalonOfCancellation).toHaveBeenCalledOnce();
    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "booking_cancelled_self_service",
        actor: "client",
      }),
    );
  });

  it("does not notify for unpaid pending holds cancelled by the client", async () => {
    const tech = makeTech({ handle: "bellarose" });
    const booking = makeBooking({
      id: "bk_hold",
      status: "pending",
      depositStatus: "none",
      depositPennies: 1500,
      cardPaymentMethodId: null,
      balanceToken: "tok_hold",
      startIso: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    });
    getTechByHandle.mockResolvedValue(tech);
    getBookingByToken.mockResolvedValue(booking);

    const { cancelClientBookingAction } = await loadAction();
    const fd = new FormData();
    fd.set("handle", "bellarose");
    fd.set("token", "tok_hold");
    await expect(cancelClientBookingAction(fd)).rejects.toThrow("NEXT_REDIRECT");

    expect(notifySalonOfCancellation).not.toHaveBeenCalled();
    expect(createAuditEvent).not.toHaveBeenCalled();
  });
});

describe("tech-initiated cancel and abandoned checkout stay silent", () => {
  it("dashboard status-change cancel path does not import salon cancel notify", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        new URL("../app/dashboard/actions.ts", import.meta.url),
        "utf8",
      ),
    );
    expect(src).not.toContain("notifySalonOfCancellation");
  });

  it("abandoned checkout release does not call salon cancel notify", async () => {
    vi.resetModules();
    const getBooking = vi.fn();
    const updateBooking = vi.fn(async () => undefined);
    const notifySalonOfNewBooking = vi.fn(async () => undefined);
    const notifySalonOfCancellation = vi.fn(async () => undefined);

    vi.doMock("@/lib/db/queries", () => ({
      getBooking,
      paymentsForBooking: vi.fn(async () => []),
      updateBooking,
      listBookingsByGroup: vi.fn(async () => []),
      createPayment: vi.fn(),
      getTechById: vi.fn(),
      createReminder: vi.fn(),
      skipScheduledReminders: vi.fn(),
    }));
    vi.doMock("@/lib/notify", () => ({
      notifySalonOfNewBooking,
      notifySalonOfCancellation,
      sendReminder: vi.fn(),
    }));
    vi.doMock("@/lib/booking/public-availability-cache", () => ({
      revalidatePublicAvailability: vi.fn(),
    }));
    vi.doMock("@/lib/google-calendar", () => ({
      syncBookingToGoogle: vi.fn(),
    }));

    getBooking.mockResolvedValue(
      makeBooking({
        id: "bk_pending",
        status: "pending",
        depositStatus: "none",
        cardPaymentMethodId: null,
      }),
    );

    const { releaseAbandonedCheckoutBooking } = await import("@/lib/bookings");
    await releaseAbandonedCheckoutBooking({} as never, makeBooking({ id: "bk_pending", status: "pending" }));

    expect(notifySalonOfCancellation).not.toHaveBeenCalled();
    expect(notifySalonOfNewBooking).not.toHaveBeenCalled();
    expect(updateBooking).toHaveBeenCalled();
  });
});

describe("waitlist rebooking uses standard new-booking notify", () => {
  it("confirming a deposit after a freed slot notifies the salon once", async () => {
    vi.resetModules();
    const getBooking = vi.fn();
    const updateBooking = vi.fn(async () => undefined);
    const paymentsForBooking = vi.fn(async () => []);
    const createPayment = vi.fn(async () => undefined);
    const getTechById = vi.fn(async () => makeTech({ stripeConnectAccountId: "acct_1" }));
    const notifySalonOfNewBooking = vi.fn(async () => undefined);

    vi.doMock("@/lib/db/queries", () => ({
      getBooking,
      paymentsForBooking,
      updateBooking,
      listBookingsByGroup: vi.fn(async () => []),
      createPayment,
      getTechById,
      createReminder: vi.fn(async () => undefined),
      skipScheduledReminders: vi.fn(async () => undefined),
    }));
    vi.doMock("@/lib/notify", () => ({
      notifySalonOfNewBooking,
      sendReminder: vi.fn(async () => true),
    }));
    vi.doMock("@/lib/booking/public-availability-cache", () => ({
      revalidatePublicAvailability: vi.fn(),
    }));
    vi.doMock("@/lib/google-calendar", () => ({
      syncBookingToGoogle: vi.fn(async () => undefined),
    }));

    // Waitlist only emails that a slot opened; the client rebooks via normal
    // checkout. That path must fire the standard new-booking salon email.
    const pending = makeBooking({
      id: "bk_waitlist_rebook",
      status: "pending",
      depositStatus: "none",
      depositPennies: 1500,
    });
    getBooking.mockResolvedValue(pending);

    const { completeBookingCheckoutFromSession } = await import("@/lib/bookings");
    await completeBookingCheckoutFromSession({} as never, {
      metadata: { bookingId: "bk_waitlist_rebook", kind: "deposit" },
      mode: "payment",
      payment_status: "paid",
      payment_intent: "pi_waitlist",
    });

    expect(notifySalonOfNewBooking).toHaveBeenCalledOnce();
    expect(notifySalonOfNewBooking).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "bk_waitlist_rebook", status: "confirmed" }),
    );
  });
});
