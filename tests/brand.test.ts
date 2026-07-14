import { describe, expect, it } from "vitest";
import { heroBrand, luminance, onBrand } from "@/lib/booking/brand";

describe("luminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(luminance("#000000")).toBe(0);
    expect(luminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("treats unparseable input as dark", () => {
    expect(luminance("not-a-colour")).toBe(0);
  });
});

describe("onBrand", () => {
  it("keeps white text on the default Glow pink", () => {
    expect(onBrand("#db2777")).toBe("#ffffff");
  });

  it("uses white text on dark brands", () => {
    expect(onBrand("#1a1a2e")).toBe("#ffffff");
  });

  it("uses dark ink on pale brands (cream, pastels)", () => {
    expect(onBrand("#e8e4c9")).not.toBe("#ffffff");
    expect(onBrand("#f9d5e5")).not.toBe("#ffffff");
    expect(onBrand("#ffffff")).not.toBe("#ffffff");
  });
});

describe("heroBrand", () => {
  it("leaves dark brands untouched", () => {
    expect(heroBrand("#db2777")).toBe("#db2777");
    expect(heroBrand("#1a1a2e")).toBe("#1a1a2e");
  });

  it("darkens pale brands until white text is readable", () => {
    const result = heroBrand("#e8e4c9");
    expect(result).not.toBe("#e8e4c9");
    expect(luminance(result)).toBeLessThanOrEqual(0.25);
    // White text needs ~4.5:1 contrast: bg luminance below ~0.183 is ideal,
    // 0.25 still gives > 3.5:1 for large/bold text.
    expect(1.05 / (luminance(result) + 0.05)).toBeGreaterThan(3.5);
  });
});
