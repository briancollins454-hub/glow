import { describe, expect, it } from "vitest";
import {
  buildPriceRiseAnnouncement,
  newPricePennies,
  previewPriceRise,
  roundToNearest50p,
} from "@/lib/price-rise";
import { makeService, makeTech } from "./fixtures";

describe("roundToNearest50p", () => {
  it("rounds to nearest 50p", () => {
    expect(roundToNearest50p(5549)).toBe(5550);
    expect(roundToNearest50p(5524)).toBe(5500);
  });
});

describe("newPricePennies", () => {
  it("applies a percentage increase", () => {
    expect(newPricePennies(5000, "percent", 10)).toBe(5500);
  });

  it("applies a fixed increase", () => {
    expect(newPricePennies(5000, "fixed", 500)).toBe(5500);
  });
});

describe("previewPriceRise", () => {
  it("returns only selected active services with changes", () => {
    const services = [
      makeService({ id: "s1", name: "Classic", pricePennies: 5000, active: true }),
      makeService({ id: "s2", name: "Infill", pricePennies: 3500, active: true }),
      makeService({ id: "s3", name: "Hidden", pricePennies: 2000, active: false }),
    ];
    const rows = previewPriceRise(services, ["s1", "s3"], { mode: "fixed", value: 500 });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("Classic");
    expect(rows[0]!.newPennies).toBe(5500);
  });
});

describe("buildPriceRiseAnnouncement", () => {
  it("includes booking link and price examples", () => {
    const preview = previewPriceRise(
      [makeService({ id: "s1", name: "Classic Full Set", pricePennies: 5000 })],
      ["s1"],
      { mode: "percent", value: 10, effectiveDate: "2026-08-01" },
    );
    const msg = buildPriceRiseAnnouncement(
      makeTech({ businessName: "Bella Rose", handle: "bella" }),
      { mode: "percent", value: 10, effectiveDate: "2026-08-01" },
      preview,
      "https://glow-uk.com",
    );
    expect(msg.email).toContain("Bella Rose");
    expect(msg.email).toContain("Classic Full Set");
    expect(msg.email).toContain("https://glow-uk.com/bella");
    expect(msg.sms).toContain("Existing bookings unchanged");
  });
});
