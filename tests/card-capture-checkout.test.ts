import { describe, expect, it, vi, beforeEach } from "vitest";
import { createCardCaptureCheckout, createDepositCheckout } from "@/lib/payments";
import { makeBooking, makeClient, makeService, makeTech } from "./fixtures";

const createSessionMock = vi.fn();
const createCustomerMock = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: () => ({
    customers: {
      create: (...args: unknown[]) => createCustomerMock(...args),
    },
    checkout: {
      sessions: {
        create: (...args: unknown[]) => createSessionMock(...args),
      },
    },
  }),
}));

describe("createCardCaptureCheckout", () => {
  const tech = makeTech({ stripeConnectAccountId: "acct_1", handle: "allurebeauty" });
  const service = makeService({ id: "svc_mTuujYWEYKCe", name: "Blemish Removal" });
  const booking = makeBooking({ id: "bk_1", balanceToken: "tok_bal" });
  const client = makeClient({ name: "Test Client", email: "test@example.com" });

  beforeEach(() => {
    createSessionMock.mockReset();
    createCustomerMock.mockReset();
    createCustomerMock.mockResolvedValue({ id: "cus_1" });
  });

  it("returns the Stripe Checkout URL", async () => {
    createSessionMock.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_test" });
    const url = await createCardCaptureCheckout(tech, service, booking, client, "https://app.example");
    expect(url).toBe("https://checkout.stripe.com/c/pay/cs_test");
    expect(createSessionMock).toHaveBeenCalledTimes(1);
    const [params, opts] = createSessionMock.mock.calls[0];
    expect(params.mode).toBe("setup");
    expect(params.custom_text).toBeTruthy();
    expect(params.cancel_url).toBe("https://app.example/allurebeauty/checkout-cancel/tok_bal");
    expect(params.expires_at).toBeTypeOf("number");
    expect(opts).toEqual({ stripeAccount: "acct_1" });
  });

  it("retries without custom_text when Connect rejects it", async () => {
    createSessionMock
      .mockRejectedValueOnce(new Error("custom_text is not supported"))
      .mockResolvedValueOnce({ url: "https://checkout.stripe.com/c/pay/cs_retry" });

    const url = await createCardCaptureCheckout(tech, service, booking, client, "https://app.example");
    expect(url).toBe("https://checkout.stripe.com/c/pay/cs_retry");
    expect(createSessionMock).toHaveBeenCalledTimes(2);
    const retryParams = createSessionMock.mock.calls[1][0];
    expect(retryParams.custom_text).toBeUndefined();
    expect(retryParams.mode).toBe("setup");
  });

  it("throws when Checkout returns no URL", async () => {
    createSessionMock.mockResolvedValue({ url: null });
    await expect(
      createCardCaptureCheckout(tech, service, booking, client, "https://app.example"),
    ).rejects.toThrow(/no URL/i);
  });
});

describe("createDepositCheckout", () => {
  const tech = makeTech({ stripeConnectAccountId: "acct_1", handle: "allurebeauty" });
  const service = makeService();
  const booking = makeBooking({ depositPennies: 1500, balanceToken: "tok_bal" });

  beforeEach(() => {
    createSessionMock.mockReset();
  });

  it("throws when Checkout returns no URL", async () => {
    createSessionMock.mockResolvedValue({ url: null });
    await expect(createDepositCheckout(tech, service, booking, "https://app.example")).rejects.toThrow(
      /no URL/i,
    );
  });

  it("points cancel_url at the checkout-cancel route and sets expires_at", async () => {
    createSessionMock.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_dep" });
    await createDepositCheckout(tech, service, booking, "https://app.example");
    const [params] = createSessionMock.mock.calls[0];
    expect(params.cancel_url).toBe("https://app.example/allurebeauty/checkout-cancel/tok_bal");
    expect(params.expires_at).toBeTypeOf("number");
    expect(params.metadata).toEqual({ bookingId: booking.id, kind: "deposit" });
  });
});
