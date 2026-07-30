import { describe, expect, it } from "vitest";
import { minorUnitFactor, money, stripeCurrency, toMinorUnits } from "@/lib/money";

describe("minorUnitFactor", () => {
  it("is 100 for two-decimal currencies and 1 for zero-decimal", () => {
    expect(minorUnitFactor("GBP")).toBe(100);
    expect(minorUnitFactor("AUD")).toBe(100);
    expect(minorUnitFactor("JPY")).toBe(1);
    expect(minorUnitFactor("KRW")).toBe(1);
  });
});

describe("money", () => {
  it("formats GBP exactly as the old gbp() helper", () => {
    expect(money(0, "GBP")).toBe("£0.00");
    expect(money(5000, "GBP")).toBe("£50.00");
    expect(money(5550, "GBP")).toBe("£55.50");
  });

  it("falls back to GBP when currency is missing", () => {
    expect(money(5000)).toBe("£50.00");
    expect(money(5000, null)).toBe("£50.00");
    expect(money(5000, "")).toBe("£50.00");
    expect(money(5000, "NOPE")).toBe("£50.00");
  });

  it("uses the currency's own locale, not en-GB", () => {
    // en-AU shows plain $, not A$.
    expect(money(5000, "AUD")).toBe("$50.00");
    expect(money(5000, "USD")).toBe("$50.00");
    expect(money(5000, "EUR")).toBe("€50.00");
  });

  it("handles zero-decimal currencies", () => {
    expect(money(500, "JPY")).toBe("￥500");
  });

  it("formats negative amounts", () => {
    expect(money(-5000, "GBP")).toBe("-£50.00");
  });
});

describe("toMinorUnits", () => {
  it("parses plain and symbol-prefixed values", () => {
    expect(toMinorUnits("50", "GBP")).toBe(5000);
    expect(toMinorUnits("50.00", "GBP")).toBe(5000);
    expect(toMinorUnits("£50.00", "GBP")).toBe(5000);
    expect(toMinorUnits("A$50", "AUD")).toBe(5000);
  });

  it("parses comma as decimal separator", () => {
    expect(toMinorUnits("50,00", "EUR")).toBe(5000);
    expect(toMinorUnits("50,5", "EUR")).toBe(5050);
  });

  it("parses mixed thousands and decimal separators", () => {
    expect(toMinorUnits("1.234,56", "EUR")).toBe(123456);
    expect(toMinorUnits("1,234.56", "GBP")).toBe(123456);
  });

  it("treats a lone separator followed by three digits as thousands", () => {
    expect(toMinorUnits("1,234", "GBP")).toBe(123400);
    expect(toMinorUnits("1.234.567", "EUR")).toBe(123456700);
  });

  it("keeps the old single-decimal behaviour", () => {
    expect(toMinorUnits("45.5", "GBP")).toBe(4550);
  });

  it("returns 0 for empty or nonsense input", () => {
    expect(toMinorUnits("", "GBP")).toBe(0);
    expect(toMinorUnits("abc", "GBP")).toBe(0);
    expect(toMinorUnits("£", "GBP")).toBe(0);
  });

  it("respects zero-decimal currencies", () => {
    expect(toMinorUnits("500", "JPY")).toBe(500);
    expect(toMinorUnits(500, "JPY")).toBe(500);
    expect(toMinorUnits("500", "GBP")).toBe(50000);
  });

  it("handles numeric input and negatives", () => {
    expect(toMinorUnits(45.5, "GBP")).toBe(4550);
    expect(toMinorUnits("-50", "GBP")).toBe(-5000);
    expect(toMinorUnits(-45.5, "GBP")).toBe(-4550);
  });
});

describe("stripeCurrency", () => {
  it("returns lowercase ISO codes", () => {
    expect(stripeCurrency("GBP")).toBe("gbp");
    expect(stripeCurrency("AUD")).toBe("aud");
    expect(stripeCurrency("JPY")).toBe("jpy");
  });

  it("falls back to gbp", () => {
    expect(stripeCurrency(null)).toBe("gbp");
    expect(stripeCurrency(undefined)).toBe("gbp");
    expect(stripeCurrency("")).toBe("gbp");
  });
});
