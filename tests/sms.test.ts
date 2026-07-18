import { describe, expect, it } from "vitest";
import { normalisePhone, smsConfigured, techAllowsSms } from "@/lib/sms";

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
