import { describe, expect, it } from "vitest";
import { checkInfill, checkPatchTest, daySlots, depositFor, evaluateEligibility } from "@/lib/rules";
import { makeBooking, makeCategory, makeClient, makePatchTest, makeService, makeWorkingHour } from "./fixtures";

describe("depositFor", () => {
  it("computes percentage deposits", () => {
    expect(depositFor(makeService({ pricePennies: 5000, depositType: "percent", depositValue: 30 }))).toBe(1500);
  });
  it("uses fixed deposits as-is", () => {
    expect(depositFor(makeService({ depositType: "fixed", depositValue: 2000 }))).toBe(2000);
  });
  it("returns zero when deposits are off", () => {
    expect(depositFor(makeService({ depositType: "none", depositValue: 30 }))).toBe(0);
  });
});

describe("checkPatchTest", () => {
  const service = makeService({ requiresPatchTest: true });
  const category = makeCategory({ patchTestMinLeadHours: 24 });
  const appointment = "2026-07-20T10:00:00.000Z";

  it("passes when no patch test is required", () => {
    const result = checkPatchTest(makeService(), makeClient(), appointment, { category, patchTests: [] });
    expect(result.ok).toBe(true);
    expect(result.required).toBe(false);
  });

  it("blocks new clients", () => {
    const result = checkPatchTest(service, null, appointment, { category, patchTests: [] });
    expect(result.ok).toBe(false);
    expect(result.detail).toBe("new_client");
  });

  it("accepts a valid passed test", () => {
    const test = makePatchTest({ performedAtIso: "2026-07-01T10:00:00.000Z", expiresAtIso: "2026-12-01T00:00:00.000Z" });
    const result = checkPatchTest(service, makeClient(), appointment, { category, patchTests: [test] });
    expect(result.ok).toBe(true);
  });

  it("rejects an expired test", () => {
    const test = makePatchTest({ expiresAtIso: "2026-07-19T00:00:00.000Z" });
    const result = checkPatchTest(service, makeClient(), appointment, { category, patchTests: [test] });
    expect(result.ok).toBe(false);
  });

  it("rejects a failed test", () => {
    const test = makePatchTest({ result: "fail" });
    const result = checkPatchTest(service, makeClient(), appointment, { category, patchTests: [test] });
    expect(result.ok).toBe(false);
  });

  it("enforces the minimum lead time before the appointment", () => {
    // Test done 2 hours before a 24h-lead category: not allowed.
    const test = makePatchTest({ performedAtIso: "2026-07-20T08:00:00.000Z", expiresAtIso: "2026-12-01T00:00:00.000Z" });
    const result = checkPatchTest(service, makeClient(), appointment, { category, patchTests: [test] });
    expect(result.ok).toBe(false);
  });
});

describe("checkInfill", () => {
  const infill = makeService({ id: "svc_infill", isInfill: true, infillMaxGapDays: 21 });
  const categoryByServiceId = { svc_1: "cat_1", svc_infill: "cat_1" };
  const appointment = "2026-07-20T10:00:00.000Z";

  it("passes for non-infill services", () => {
    expect(checkInfill(makeService(), makeClient(), appointment, { priorBookings: [], categoryByServiceId }).ok).toBe(true);
  });

  it("blocks new clients", () => {
    const result = checkInfill(infill, null, appointment, { priorBookings: [], categoryByServiceId });
    expect(result.ok).toBe(false);
    expect(result.detail).toBe("new_client");
  });

  it("allows a recent returning client", () => {
    const prior = makeBooking({ startIso: "2026-07-10T10:00:00.000Z", status: "completed" });
    expect(checkInfill(infill, makeClient(), appointment, { priorBookings: [prior], categoryByServiceId }).ok).toBe(true);
  });

  it("blocks when the gap is too long", () => {
    const prior = makeBooking({ startIso: "2026-05-01T10:00:00.000Z", status: "completed" });
    const result = checkInfill(infill, makeClient(), appointment, { priorBookings: [prior], categoryByServiceId });
    expect(result.ok).toBe(false);
    expect(result.detail).toBe("too_long");
  });
});

describe("evaluateEligibility", () => {
  it("blocks blacklisted clients even when other rules pass", () => {
    const result = evaluateEligibility(makeService(), makeClient({ isBlacklisted: true }), "2026-07-20T10:00:00.000Z", {
      category: makeCategory(),
      patchTests: [],
      priorBookings: [],
      categoryByServiceId: {},
    });
    expect(result.ok).toBe(false);
    expect(result.blacklisted).toBe(true);
  });
});

describe("daySlots", () => {
  // 2030-07-10 is a Wednesday (weekday 3). July = BST, so 09:00 London = 08:00 UTC.
  const dateStr = "2030-07-10";
  const now = new Date("2030-07-01T00:00:00.000Z").getTime();
  const service = makeService({ durationMin: 60 });

  it("starts at opening time in the London timezone", () => {
    const slots = daySlots(service, dateStr, { workingHours: [makeWorkingHour()], timeOff: [], bookings: [] }, now);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]).toBe("2030-07-10T08:00:00.000Z");
  });

  it("returns nothing on closed days", () => {
    const closed = makeWorkingHour({ enabled: false });
    expect(daySlots(service, dateStr, { workingHours: [closed], timeOff: [], bookings: [] }, now)).toEqual([]);
  });

  it("excludes times that clash with an existing booking", () => {
    const busy = makeBooking({
      startIso: "2030-07-10T08:00:00.000Z",
      endIso: "2030-07-10T09:00:00.000Z",
      status: "confirmed",
    });
    const slots = daySlots(service, dateStr, { workingHours: [makeWorkingHour()], timeOff: [], bookings: [busy] }, now);
    expect(slots).not.toContain("2030-07-10T08:00:00.000Z");
    expect(slots.length).toBeGreaterThan(0);
  });

  it("respects a custom last-start time", () => {
    const wh = makeWorkingHour({ lastStartMinutes: 10 * 60 }); // last start 10:00 London
    const slots = daySlots(service, dateStr, { workingHours: [wh], timeOff: [], bookings: [] }, now);
    expect(slots[slots.length - 1]).toBe("2030-07-10T09:00:00.000Z");
  });
});
