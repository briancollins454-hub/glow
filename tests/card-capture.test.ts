import { describe, expect, it } from "vitest";
import { noShowFeeFor } from "@/lib/rules";
import { usesCardCapture } from "@/lib/subscriptions";
import { makeTech } from "./fixtures";

describe("noShowFeeFor", () => {
  it("charges a percentage of the price", () => {
    const tech = makeTech({ noShowFeeType: "percent", noShowFeeValue: 50, noShowFeePct: 50 });
    expect(noShowFeeFor(tech, 6000)).toBe(3000);
  });

  it("charges the full price at 100%", () => {
    const tech = makeTech({ noShowFeeType: "percent", noShowFeeValue: 100, noShowFeePct: 100 });
    expect(noShowFeeFor(tech, 4500)).toBe(4500);
  });

  it("charges a fixed amount, capped at the booking price", () => {
    const tech = makeTech({ noShowFeeType: "fixed", noShowFeeValue: 2000 });
    expect(noShowFeeFor(tech, 6000)).toBe(2000);
    expect(noShowFeeFor(tech, 1500)).toBe(1500);
  });

  it("falls back to noShowFeePct when type/value are missing (pre-migration rows)", () => {
    const tech = makeTech({ noShowFeePct: 25 });
    expect(
      noShowFeeFor({ noShowFeePct: tech.noShowFeePct, noShowFeeType: undefined, noShowFeeValue: undefined }, 8000),
    ).toBe(2000);
  });

  it("is zero when the fee is zero", () => {
    const tech = makeTech({ noShowFeeType: "percent", noShowFeeValue: 0, noShowFeePct: 0 });
    expect(noShowFeeFor(tech, 6000)).toBe(0);
  });
});

describe("usesCardCapture", () => {
  it("is on only when the tech chose card capture AND Stripe payments are ready", () => {
    expect(
      usesCardCapture(makeTech({ noShowProtection: "card_capture", connectChargesEnabled: true })),
    ).toBe(true);
  });

  it("is off without Stripe payments ready", () => {
    expect(
      usesCardCapture(makeTech({ noShowProtection: "card_capture", connectChargesEnabled: false })),
    ).toBe(false);
  });

  it("is off in deposit mode and for pre-migration rows", () => {
    expect(usesCardCapture(makeTech({ noShowProtection: "deposit", connectChargesEnabled: true }))).toBe(false);
    expect(usesCardCapture(makeTech({ noShowProtection: null, connectChargesEnabled: true }))).toBe(false);
    expect(
      usesCardCapture({ connectChargesEnabled: true } as ReturnType<typeof makeTech>),
    ).toBe(false);
  });
});
