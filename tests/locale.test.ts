import { describe, expect, it } from "vitest";
import {
  CURRENCIES,
  salonCountry,
  salonCurrency,
  salonLocale,
  salonTz,
  localeFromTimezone,
  DEFAULT_COUNTRY,
  DEFAULT_CURRENCY,
  DEFAULT_TZ,
} from "@/lib/locale";

describe("salonLocale fallbacks", () => {
  it("falls back for null, undefined, and empty string", () => {
    expect(salonCurrency(null)).toBe(DEFAULT_CURRENCY);
    expect(salonCurrency(undefined)).toBe(DEFAULT_CURRENCY);
    expect(salonCurrency({})).toBe(DEFAULT_CURRENCY);
    expect(salonCurrency({ currency: "" })).toBe(DEFAULT_CURRENCY);
    expect(salonCurrency({ currency: "   " })).toBe(DEFAULT_CURRENCY);
    expect(salonCountry({ country: null })).toBe(DEFAULT_COUNTRY);
    expect(salonTz({ timezone: undefined })).toBe(DEFAULT_TZ);
    expect(salonLocale(null)).toEqual({
      currency: DEFAULT_CURRENCY,
      country: DEFAULT_COUNTRY,
      timezone: DEFAULT_TZ,
    });
  });

  it("returns stored values when present", () => {
    expect(
      salonLocale({ currency: "AUD", country: "AU", timezone: "Australia/Sydney" }),
    ).toEqual({
      currency: "AUD",
      country: "AU",
      timezone: "Australia/Sydney",
    });
  });
});

describe("CURRENCIES", () => {
  it("every entry has a locale Intl.NumberFormat accepts", () => {
    for (const c of CURRENCIES) {
      expect(() => new Intl.NumberFormat(c.locale, { style: "currency", currency: c.code })).not.toThrow();
      const formatted = new Intl.NumberFormat(c.locale, {
        style: "currency",
        currency: c.code,
      }).format(12.34);
      expect(formatted.length).toBeGreaterThan(0);
    }
  });

  it("marks zero-decimal currencies", () => {
    expect(CURRENCIES.find((c) => c.code === "JPY")?.digits).toBe(0);
    expect(CURRENCIES.find((c) => c.code === "GBP")?.digits).toBe(2);
  });
});

describe("localeFromTimezone", () => {
  it("maps common zones and defaults unknown", () => {
    expect(localeFromTimezone("Australia/Sydney")).toMatchObject({
      country: "AU",
      currency: "AUD",
      timezone: "Australia/Sydney",
    });
    expect(localeFromTimezone("Not/AZone")).toEqual({
      currency: DEFAULT_CURRENCY,
      country: DEFAULT_COUNTRY,
      timezone: DEFAULT_TZ,
    });
    expect(localeFromTimezone("")).toEqual({
      currency: DEFAULT_CURRENCY,
      country: DEFAULT_COUNTRY,
      timezone: DEFAULT_TZ,
    });
  });
});
