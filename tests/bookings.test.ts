import { describe, expect, it } from "vitest";
import { loyaltyDiscountFor } from "@/lib/bookings";

describe("loyaltyDiscountFor", () => {
  const tech = { loyaltyVisitThreshold: 5, loyaltyDiscountPct: 10 };

  it("gives nothing below the visit threshold", () => {
    expect(loyaltyDiscountFor(tech, 4, 5000)).toBe(0);
  });
  it("discounts once the threshold is reached", () => {
    expect(loyaltyDiscountFor(tech, 5, 5000)).toBe(500);
  });
  it("VIPs always qualify", () => {
    expect(loyaltyDiscountFor(tech, 0, 5000, true)).toBe(500);
  });
  it("does nothing when the programme is off", () => {
    expect(loyaltyDiscountFor({ loyaltyVisitThreshold: 0, loyaltyDiscountPct: 0 }, 10, 5000, true)).toBe(0);
  });
  it("supports a fixed £ discount", () => {
    expect(
      loyaltyDiscountFor(
        { loyaltyVisitThreshold: 5, loyaltyDiscountPct: 10, loyaltyDiscountType: "fixed", loyaltyDiscountValue: 750 },
        5,
        5000,
      ),
    ).toBe(750);
  });
});
