import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  salonTakesClientPayments,
  clientOnlinePaymentsActive,
  usesCardCapture,
  sendsBalanceEmails,
} from "@/lib/subscriptions";
import {
  createDepositCheckout,
  createCardCaptureCheckout,
  createBalanceCheckout,
  chargeNoShowFee,
} from "@/lib/payments";
import { stripeErrorMessage } from "@/lib/stripe-errors";
import { depositFor } from "@/lib/rules";
import { makeBooking, makeClient, makeService, makeTech } from "./fixtures";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

const createLoginLinkMock = vi.fn();
const createSessionMock = vi.fn();
const createCustomerMock = vi.fn();
const createPaymentIntentMock = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: () => ({
    accounts: {
      createLoginLink: (...args: unknown[]) => createLoginLinkMock(...args),
    },
    customers: {
      create: (...args: unknown[]) => createCustomerMock(...args),
    },
    checkout: {
      sessions: {
        create: (...args: unknown[]) => createSessionMock(...args),
      },
    },
    paymentIntents: {
      create: (...args: unknown[]) => createPaymentIntentMock(...args),
    },
  }),
}));

describe("salonTakesClientPayments / clientOnlinePaymentsActive", () => {
  it("defaults to on (missing / null / pre-migration)", () => {
    expect(salonTakesClientPayments(null)).toBe(true);
    expect(salonTakesClientPayments(undefined)).toBe(true);
    expect(salonTakesClientPayments({})).toBe(true);
    expect(salonTakesClientPayments({ clientPaymentsEnabled: null })).toBe(true);
    expect(salonTakesClientPayments({ clientPaymentsEnabled: true })).toBe(true);
  });

  it("off only when explicitly disabled", () => {
    expect(salonTakesClientPayments({ clientPaymentsEnabled: false })).toBe(false);
  });

  it("online payments need both the switch and Connect charges", () => {
    const ready = makeTech({ connectChargesEnabled: true, clientPaymentsEnabled: true });
    const off = makeTech({ connectChargesEnabled: true, clientPaymentsEnabled: false });
    const noConnect = makeTech({ connectChargesEnabled: false, clientPaymentsEnabled: true });
    expect(clientOnlinePaymentsActive(ready)).toBe(true);
    expect(clientOnlinePaymentsActive(off)).toBe(false);
    expect(clientOnlinePaymentsActive(noConnect)).toBe(false);
  });

  it("card capture and balance emails: capture independent of switch; balance emails respect it", () => {
    const connectedCapture = makeTech({
      connectChargesEnabled: true,
      noShowProtection: "card_capture",
      clientPaymentsEnabled: false,
    });
    expect(usesCardCapture(connectedCapture)).toBe(true);
    expect(sendsBalanceEmails({ balanceEmailsEnabled: true, clientPaymentsEnabled: false })).toBe(
      false,
    );
  });
});

describe("checkout builders reject deposit/balance when client payments are off", () => {
  const service = makeService();
  const booking = makeBooking({ depositPennies: 1500, balancePennies: 3500 });
  const client = makeClient();
  const off = makeTech({
    stripeConnectAccountId: "acct_1",
    connectChargesEnabled: true,
    clientPaymentsEnabled: false,
  });

  beforeEach(() => {
    createSessionMock.mockReset();
    createCustomerMock.mockReset();
    createPaymentIntentMock.mockReset();
  });

  it("createDepositCheckout throws", async () => {
    await expect(createDepositCheckout(off, service, booking, "https://app.example")).rejects.toThrow(
      /Client payments are turned off/i,
    );
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("createCardCaptureCheckout still works when switch is off", async () => {
    createCustomerMock.mockResolvedValue({ id: "cus_1" });
    createSessionMock.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_card" });
    const url = await createCardCaptureCheckout(off, service, booking, client, "https://app.example");
    expect(url).toContain("checkout.stripe.com");
    expect(createSessionMock).toHaveBeenCalled();
  });

  it("createBalanceCheckout throws", async () => {
    await expect(createBalanceCheckout(off, service, booking, "https://app.example")).rejects.toThrow(
      /Client payments are turned off/i,
    );
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("chargeNoShowFee still charges when switch is off", async () => {
    createPaymentIntentMock.mockResolvedValue({ status: "succeeded", id: "pi_ns" });
    const result = await chargeNoShowFee(
      off,
      {
        id: "bk_1",
        cardCustomerId: "cus_1",
        cardPaymentMethodId: "pm_1",
      },
      2500,
    );
    expect(result).toEqual({ ok: true, paymentIntentId: "pi_ns" });
    expect(createPaymentIntentMock).toHaveBeenCalled();
  });

  it("with switch on, deposit checkout still creates a session", async () => {
    const on = makeTech({ stripeConnectAccountId: "acct_1", clientPaymentsEnabled: true });
    createSessionMock.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_ok" });
    const url = await createDepositCheckout(on, service, booking, "https://app.example");
    expect(url).toContain("checkout.stripe.com");
    expect(createSessionMock).toHaveBeenCalledTimes(1);
  });
});

describe("per-service deposits are preserved when switch is off", () => {
  it("depositFor still reads configured values (non-destructive)", () => {
    const service = makeService({ depositType: "percent", depositValue: 30, pricePennies: 5000 });
    expect(depositFor(service)).toBe(1500);
  });

  it("service form keeps deposit fields and shows inactive note", () => {
    const form = read("components/dashboard/service-form.tsx");
    expect(form).toContain("clientPaymentsEnabled");
    expect(form).toContain("Deposits are off for this salon");
    expect(form).toContain("DepositFields");
  });
});

describe("Stripe Express login link", () => {
  beforeEach(() => {
    createLoginLinkMock.mockReset();
    vi.resetModules();
  });

  it("createExpressLoginLink returns a fresh URL", async () => {
    createLoginLinkMock.mockResolvedValue({ url: "https://connect.stripe.com/express/acct_login" });
    const { createExpressLoginLink } = await import("@/lib/connect");
    const url = await createExpressLoginLink("acct_own");
    expect(url).toBe("https://connect.stripe.com/express/acct_login");
    expect(createLoginLinkMock).toHaveBeenCalledWith("acct_own");
  });

  it("openStripePaymentsAction returns a URL for the session tech only", async () => {
    createLoginLinkMock.mockResolvedValue({ url: "https://connect.stripe.com/express/fresh" });
    vi.doMock("@/lib/auth/session", () => ({
      getDashboardContext: async () => ({
        sb: {},
        tech: makeTech({ stripeConnectAccountId: "acct_session_only" }),
      }),
    }));
    vi.doMock("@/lib/connect", () => ({
      ensureConnectAccount: vi.fn(),
      createOnboardingLink: vi.fn(),
      createExpressLoginLink: async (id: string) => {
        expect(id).toBe("acct_session_only");
        return "https://connect.stripe.com/express/fresh";
      },
    }));
    const { openStripePaymentsAction } = await import("@/app/dashboard/payments/actions");
    const result = await openStripePaymentsAction();
    expect(result).toEqual({ url: "https://connect.stripe.com/express/fresh" });
  });

  it("openStripePaymentsAction prompts connect when no account", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      getDashboardContext: async () => ({
        sb: {},
        tech: makeTech({ stripeConnectAccountId: null }),
      }),
    }));
    vi.doMock("@/lib/connect", () => ({
      ensureConnectAccount: vi.fn(),
      createOnboardingLink: vi.fn(),
      createExpressLoginLink: vi.fn(),
    }));
    const { openStripePaymentsAction } = await import("@/app/dashboard/payments/actions");
    const result = await openStripePaymentsAction();
    expect(result).toEqual({
      error: "Connect Stripe first to view your payments.",
      needsConnect: true,
    });
  });

  it("openStripePaymentsAction surfaces a readable Stripe API error", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      getDashboardContext: async () => ({
        sb: {},
        tech: makeTech({ stripeConnectAccountId: "acct_1" }),
      }),
    }));
    vi.doMock("@/lib/connect", () => ({
      ensureConnectAccount: vi.fn(),
      createOnboardingLink: vi.fn(),
      createExpressLoginLink: async () => {
        throw { message: "This account cannot create login links" };
      },
    }));
    const { openStripePaymentsAction } = await import("@/app/dashboard/payments/actions");
    const result = await openStripePaymentsAction();
    expect(result).toEqual({ error: "This account cannot create login links" });
  });

  it("openStripePaymentsAction is tech-scoped and never takes an account id from the client", () => {
    const actions = read("app/dashboard/payments/actions.ts");
    expect(actions).toContain("openStripePaymentsAction");
    expect(actions).toContain("createExpressLoginLink");
    expect(actions).toContain("c.tech.stripeConnectAccountId");
    // No form/accountId parameter — only the session tech's account.
    expect(actions).not.toMatch(/openStripePaymentsAction\([^)]*accountId/);
    expect(actions).toContain("stripeErrorMessage");
    expect(actions).toContain("needsConnect");
  });

  it("unconnected tech gets the connect prompt path", () => {
    const actions = read("app/dashboard/payments/actions.ts");
    expect(actions).toContain("Connect Stripe first to view your payments.");
    expect(actions).toContain("needsConnect: true");
  });

  it("button generates fresh links and shows helper copy", () => {
    const button = read("components/dashboard/stripe-payments-login-button.tsx");
    expect(button).toContain("View my payments in Stripe");
    expect(button).toContain("openStripePaymentsAction");
    expect(button).toContain("window.open");
    expect(button).toContain("Money from");
    expect(button).toContain("Glow never holds it");
    expect(button).not.toMatch(/localStorage|sessionStorage/);
    expect(button).not.toMatch(/cachedUrl|storedUrl|saveUrl/);
  });

  it("stripeErrorMessage surfaces readable Stripe errors", () => {
    expect(stripeErrorMessage({ message: "Account cannot create login links" })).toBe(
      "Account cannot create login links",
    );
    expect(stripeErrorMessage(null)).toMatch(/Something went wrong/i);
  });
});

describe("write-path and UI guards when client payments are off", () => {
  it("public booking actions zero deposit; card capture still starts without the switch", () => {
    const actions = read("app/[handle]/actions.ts");
    expect(actions).toContain("salonTakesClientPayments");
    expect(actions).toContain("clientOnlinePaymentsActive");
    expect(actions).toMatch(/zeroDeposit|!takeClientPay/);
    expect(actions).toContain("startCardCheckout");
    expect(actions).toContain("startDepositCheckout");
  });

  it("payDeposit / payBalance reject when switch is off; saveCard does not", () => {
    const bookedActions = read("app/[handle]/booked/[token]/actions.ts");
    expect(bookedActions).toContain("salonTakesClientPayments");
    // saveCardAction must not require the client-payments switch.
    const saveCard = bookedActions.slice(bookedActions.indexOf("export async function saveCardAction"));
    const saveCardBody = saveCard.slice(0, saveCard.indexOf("export async function cancelClientBookingAction"));
    expect(saveCardBody).not.toContain("salonTakesClientPayments");
    expect(saveCardBody).toContain("usesCardCapture");
    expect(read("app/pay/actions.ts")).toContain("salonTakesClientPayments");
  });

  it("manage-booking and pay pages hide deposit/balance CTAs when off", () => {
    const booked = read("app/[handle]/booked/[token]/page.tsx");
    expect(booked).toContain("salonTakesClientPayments");
    expect(booked).toContain("showPayBalance");
    const pay = read("app/pay/[token]/page.tsx");
    expect(pay).toContain("salonTakesClientPayments");
    expect(pay).toContain("canPayOnline");
  });

  it("approveBookingRequest skips deposits when switch is off but keeps card capture", () => {
    const bookings = read("lib/bookings.ts");
    expect(bookings).toContain("salonTakesClientPayments");
    expect(bookings).toMatch(/takeClientPay && booking\.depositPennies > 0/);
    expect(bookings).toMatch(/needsCard = usesCardCapture\(tech\)/);
  });

  it("card protection is not gated by the client-payments switch", () => {
    const src = read("lib/card-protection.ts");
    expect(src).not.toContain("client_payments_disabled");
    expect(src).not.toContain("salonTakesClientPayments");
  });

  it("settings exposes the master switch and the action saves it", () => {
    expect(read("app/dashboard/settings/page.tsx")).toContain('name="clientPaymentsEnabled"');
    expect(read("app/dashboard/settings/page.tsx")).toContain("Take payments from clients");
    expect(read("app/dashboard/settings/page.tsx")).toContain("Card-on-file protection");
    expect(read("app/dashboard/actions.ts")).toContain(
      'clientPaymentsEnabled: formData.get("clientPaymentsEnabled") === "on"',
    );
  });

  it("payments page and onboarding mention first payout timing and switch governance", () => {
    const payments = read("app/dashboard/payments/page.tsx");
    expect(payments).toContain("7 to 14 days");
    expect(payments).toContain("Connecting alone does not start charging");
    expect(payments).toContain("StripePaymentsLoginButton");
    const dash = read("app/dashboard/page.tsx");
    expect(dash).toContain("7 to 14 days");
    expect(dash).toContain("Connecting alone does not start charging");
  });

  it("tech-side settle-up and cash recording are not gated by the switch", () => {
    const dash = read("app/dashboard/actions.ts");
    const settle = dash.slice(dash.indexOf("export async function settlePastBookingAction"));
    const cash = dash.slice(dash.indexOf("export async function recordManualPaymentAction"));
    expect(settle).not.toContain("salonTakesClientPayments");
    expect(cash.slice(0, 800)).not.toContain("salonTakesClientPayments");
  });

  it("migration adds the column defaulting to on", () => {
    const sql = read("supabase/migrations/0051_client_payments_enabled.sql");
    expect(sql).toMatch(/clientPaymentsEnabled" boolean not null default true/);
    expect(sql).toMatch(/Card capture and no-show fees are independent/i);
  });
});

describe("chargeCardProtectionFee ignores clientPaymentsEnabled", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("still charges when salon switch is off if a card is on file", async () => {
    const chargeNoShowFeeMock = vi.fn(async () => ({ ok: true, paymentIntentId: "pi_ns" }));
    const createPayment = vi.fn(async () => undefined);
    const createAuditEvent = vi.fn(async () => undefined);
    vi.doMock("@/lib/payments", () => ({ chargeNoShowFee: chargeNoShowFeeMock }));
    vi.doMock("@/lib/db/queries", () => ({ createPayment, createAuditEvent }));

    const { chargeCardProtectionFee } = await import("@/lib/card-protection");
    const tech = makeTech({
      stripeConnectAccountId: "acct_1",
      connectChargesEnabled: true,
      clientPaymentsEnabled: false,
      noShowFeeType: "percent",
      noShowFeeValue: 100,
    });
    const result = await chargeCardProtectionFee(
      {} as never,
      tech,
      {
        id: "bk_off",
        techId: "tech_1",
        pricePennies: 5000,
        cardCustomerId: "cus_1",
        cardPaymentMethodId: "pm_1",
      },
      "no_show",
    );
    expect(result).toEqual({
      outcome: "charged",
      amountPennies: 5000,
      paymentIntentId: "pi_ns",
    });
    expect(chargeNoShowFeeMock).toHaveBeenCalled();
  });
});

describe("client-facing messaging when clientPaymentsEnabled is false", () => {
  const booking = makeBooking({
    depositPennies: 1500,
    balancePennies: 3500,
    pricePennies: 5000,
    balanceToken: "tok_bal",
  });
  const client = makeClient({ name: "Sophie Turner" });
  const service = makeService({ name: "Classic Full Set" });
  const baseReminder = {
    id: "rem_1",
    techId: "tech_1",
    bookingId: booking.id,
    clientId: client.id,
    channel: "email" as const,
    sendAtIso: "2026-06-01T00:00:00.000Z",
    status: "pending" as const,
    preview: "",
    sentAtIso: null,
    createdAt: "2026-05-01T00:00:00.000Z",
  };

  it("confirmation has no pay link or amount-due wording when switch is off", async () => {
    const { renderReminderText } = await import("@/lib/reminder-copy");
    const off = makeTech({ clientPaymentsEnabled: false, businessName: "Bella Rose Beauty" });
    const text = renderReminderText({
      reminder: { ...baseReminder, kind: "confirmation" },
      booking,
      client,
      service,
      tech: off,
    });
    expect(text).toContain("Classic Full Set");
    expect(text).toContain("Price:");
    expect(text).toContain("£50.00");
    expect(text).not.toMatch(/deposit|balance due|pay |\/pay\//i);
  });

  it("confirmation keeps deposit/balance wording when switch is on", async () => {
    const { renderReminderText } = await import("@/lib/reminder-copy");
    const on = makeTech({ clientPaymentsEnabled: true, businessName: "Bella Rose Beauty" });
    const text = renderReminderText({
      reminder: { ...baseReminder, kind: "confirmation" },
      booking,
      client,
      service,
      tech: on,
    });
    expect(text).toContain("Deposit of");
    expect(text).toContain("Balance due:");
  });

  it("reminders contain no payment content", async () => {
    const { renderReminderText } = await import("@/lib/reminder-copy");
    const off = makeTech({ clientPaymentsEnabled: false });
    for (const kind of ["reminder_24h", "reminder_2h"] as const) {
      const text = renderReminderText({
        reminder: { ...baseReminder, kind },
        booking,
        client,
        service,
        tech: off,
      });
      expect(text).not.toMatch(/deposit|balance|pay |\/pay\//i);
    }
  });

  it("balance_request text is empty when switch is off (payment-only chaser)", async () => {
    const { renderReminderText } = await import("@/lib/reminder-copy");
    const off = makeTech({ clientPaymentsEnabled: false });
    const text = renderReminderText({
      reminder: { ...baseReminder, kind: "balance_request" },
      booking,
      client,
      service,
      tech: off,
    });
    expect(text).toBe("");
  });

  it("balance_request text is unchanged when switch is on", async () => {
    const { renderReminderText } = await import("@/lib/reminder-copy");
    const on = makeTech({ clientPaymentsEnabled: true });
    const text = renderReminderText({
      reminder: { ...baseReminder, kind: "balance_request" },
      booking,
      client,
      service,
      tech: on,
    });
    expect(text).toMatch(/remaining balance/i);
    expect(text).toContain("/pay/");
  });

  it("notify confirmation email strips payment copy when off; sendReminder skips chasers", () => {
    const notify = read("lib/notify.ts");
    expect(notify).toContain("salonTakesClientPayments(tech)");
    expect(notify).toMatch(/Price: \$\{gbp\(booking\.pricePennies\)\}/);
    expect(notify).toContain('reminder.kind === "balance_request" && !sendsBalanceEmails(tech)');
    expect(notify).toContain("Balance request skipped — client payments off");
    // Approval email: deposits gated by switch; card capture independent.
    expect(notify).toMatch(/takeClientPay && booking\.status === "pending" && booking\.depositPennies > 0/);
    expect(notify).toMatch(/needsCard =\s*usesCardCapture\(tech\)/);
  });

  it("requested and manage-booking pages suppress deposit promises when off", () => {
    expect(read("app/[handle]/requested/[token]/page.tsx")).toContain(
      "You'll get an email once they've reviewed it.",
    );
    const booked = read("app/[handle]/booked/[token]/page.tsx");
    expect(booked).toContain("takeClientPay ? (");
    expect(booked).toContain("Balance due on the day");
  });
});
