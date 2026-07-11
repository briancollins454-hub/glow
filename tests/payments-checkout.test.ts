import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  checkoutMatchesBalance,
  checkoutMatchesDeposit,
  confirmCheckoutPaid,
} from "@/lib/payments";
import { makeBooking, makeTech } from "./fixtures";

const retrieveMock = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: () => ({
    checkout: {
      sessions: {
        retrieve: (...args: unknown[]) => retrieveMock(...args),
      },
    },
  }),
}));

describe("confirmCheckoutPaid session matching", () => {
  const tech = makeTech({ stripeConnectAccountId: "acct_1" });
  const booking = makeBooking({
    id: "bk_deposit",
    depositPennies: 1500,
    balancePennies: 3500,
    depositStatus: "none",
    balanceStatus: "unpaid",
  });

  beforeEach(() => {
    retrieveMock.mockReset();
  });

  it("returns booking metadata and amount from a paid session", async () => {
    retrieveMock.mockResolvedValue({
      payment_status: "paid",
      payment_intent: "pi_abc",
      amount_total: 1500,
      metadata: { bookingId: "bk_deposit", kind: "deposit" },
    });

    const result = await confirmCheckoutPaid(tech, "cs_test", 1);
    expect(result).toEqual({
      paid: true,
      paymentIntentId: "pi_abc",
      bookingId: "bk_deposit",
      kind: "deposit",
      amountTotal: 1500,
    });
    expect(checkoutMatchesDeposit(result, booking)).toBe(true);
  });

  it("rejects mismatched bookingId", async () => {
    retrieveMock.mockResolvedValue({
      payment_status: "paid",
      payment_intent: "pi_abc",
      amount_total: 1500,
      metadata: { bookingId: "bk_other", kind: "deposit" },
    });
    const result = await confirmCheckoutPaid(tech, "cs_test", 1);
    expect(checkoutMatchesDeposit(result, booking)).toBe(false);
  });

  it("rejects mismatched kind for deposit", async () => {
    retrieveMock.mockResolvedValue({
      payment_status: "paid",
      payment_intent: "pi_abc",
      amount_total: 1500,
      metadata: { bookingId: "bk_deposit", kind: "balance" },
    });
    const result = await confirmCheckoutPaid(tech, "cs_test", 1);
    expect(checkoutMatchesDeposit(result, booking)).toBe(false);
  });

  it("rejects mismatched amount for deposit", async () => {
    retrieveMock.mockResolvedValue({
      payment_status: "paid",
      payment_intent: "pi_abc",
      amount_total: 999,
      metadata: { bookingId: "bk_deposit", kind: "deposit" },
    });
    const result = await confirmCheckoutPaid(tech, "cs_test", 1);
    expect(checkoutMatchesDeposit(result, booking)).toBe(false);
  });

  it("rejects mismatched amount for balance", async () => {
    retrieveMock.mockResolvedValue({
      payment_status: "paid",
      payment_intent: "pi_bal",
      amount_total: 100,
      metadata: { bookingId: "bk_deposit", kind: "balance" },
    });
    const result = await confirmCheckoutPaid(tech, "cs_test", 1);
    expect(checkoutMatchesBalance(result, booking)).toBe(false);
  });

  it("accepts a matching balance session", async () => {
    retrieveMock.mockResolvedValue({
      payment_status: "paid",
      payment_intent: "pi_bal",
      amount_total: 3500,
      metadata: { bookingId: "bk_deposit", kind: "balance" },
    });
    const result = await confirmCheckoutPaid(tech, "cs_test", 1);
    expect(checkoutMatchesBalance(result, booking)).toBe(true);
  });
});
