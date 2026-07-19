import { describe, expect, it, vi, beforeEach } from "vitest";
import { makeTech } from "./fixtures";

describe("chargeCardProtectionFee", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("skips when there is no saved card", async () => {
    vi.doMock("@/lib/payments", () => ({
      chargeNoShowFee: vi.fn(),
    }));
    vi.doMock("@/lib/db/queries", () => ({
      createPayment: vi.fn(),
      createAuditEvent: vi.fn(),
    }));

    const { chargeCardProtectionFee } = await import("@/lib/card-protection");
    const result = await chargeCardProtectionFee(
      {} as never,
      makeTech({ stripeConnectAccountId: "acct_1", noShowFeeType: "percent", noShowFeeValue: 100 }),
      {
        id: "bk_1",
        techId: "tech_1",
        pricePennies: 5000,
        cardCustomerId: null,
        cardPaymentMethodId: null,
      },
      "late_cancel",
    );
    expect(result).toEqual({ outcome: "skipped", amountPennies: 0, reason: "no_saved_card" });
  });

  it("charges late-cancel fees against a saved card", async () => {
    const chargeNoShowFee = vi.fn(async () => ({ ok: true, paymentIntentId: "pi_late" }));
    const createPayment = vi.fn(async () => undefined);
    const createAuditEvent = vi.fn(async () => undefined);
    vi.doMock("@/lib/payments", () => ({ chargeNoShowFee }));
    vi.doMock("@/lib/db/queries", () => ({ createPayment, createAuditEvent }));

    const { chargeCardProtectionFee } = await import("@/lib/card-protection");
    const tech = makeTech({
      stripeConnectAccountId: "acct_1",
      noShowFeeType: "percent",
      noShowFeeValue: 50,
      noShowFeePct: 50,
    });
    const result = await chargeCardProtectionFee(
      {} as never,
      tech,
      {
        id: "bk_2",
        techId: tech.id,
        pricePennies: 8000,
        cardCustomerId: "cus_1",
        cardPaymentMethodId: "pm_1",
      },
      "late_cancel",
    );

    expect(result).toEqual({
      outcome: "charged",
      amountPennies: 4000,
      paymentIntentId: "pi_late",
    });
    expect(chargeNoShowFee).toHaveBeenCalledWith(
      tech,
      expect.objectContaining({ id: "bk_2" }),
      4000,
      { reason: "late_cancel" },
    );
    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "late_cancel_fee_charged" }),
    );
  });
});
