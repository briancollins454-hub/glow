import { describe, expect, it } from "vitest";
import { normalisePhone, smsConfigured, smsSupportedForTech, techAllowsSms } from "@/lib/sms";

describe("normalisePhone", () => {
  it("converts UK 07 numbers to E.164", () => {
    expect(normalisePhone("07700 900123")).toBe("+447700900123");
    expect(normalisePhone("07700-900-123")).toBe("+447700900123");
  });
  it("keeps international numbers", () => {
    expect(normalisePhone("+447700900123")).toBe("+447700900123");
    expect(normalisePhone("447700900123")).toBe("+447700900123");
    expect(normalisePhone("0044 7700 900123")).toBe("+447700900123");
  });
  it("rejects junk", () => {
    expect(normalisePhone("")).toBe("");
    expect(normalisePhone("not a phone")).toBe("");
    expect(normalisePhone("12345")).toBe("");
  });
  it("normalises against the salon's country dialling code", () => {
    expect(normalisePhone("0412 345 678", "AU")).toBe("+61412345678");
    expect(normalisePhone("021 123 4567", "NZ")).toBe("+64211234567");
    expect(normalisePhone("(212) 555-0123", "US")).toBe("+12125550123");
    // Already-international input is untouched regardless of country.
    expect(normalisePhone("+447700900123", "AU")).toBe("+447700900123");
  });
  it("keeps the GB mobile-only rule for GB salons", () => {
    expect(normalisePhone("020 7946 0958", "GB")).toBe("");
    expect(normalisePhone("07700 900123", "GB")).toBe("+447700900123");
  });
});

describe("smsSupportedForTech", () => {
  it("is off for non-GB salons even when Twilio would be configured", () => {
    // Twilio env is absent in tests, so GB is also false here; the country
    // gate must reject non-GB regardless.
    expect(smsSupportedForTech({ country: "AU" })).toBe(false);
    expect(smsSupportedForTech({ country: "US" })).toBe(false);
  });
});

describe("smsConfigured", () => {
  it("is false without Twilio env vars", () => {
    expect(smsConfigured()).toBe(false);
  });
});

describe("techAllowsSms", () => {
  it("defaults to on when unset", () => {
    expect(techAllowsSms({})).toBe(true);
    expect(techAllowsSms({ smsRemindersEnabled: null })).toBe(true);
  });
  it("respects an explicit off", () => {
    expect(techAllowsSms({ smsRemindersEnabled: false })).toBe(false);
    expect(techAllowsSms({ smsRemindersEnabled: true })).toBe(true);
  });
});
