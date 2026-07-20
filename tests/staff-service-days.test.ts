import { describe, expect, it } from "vitest";
import {
  daySlots,
  daySlotsForDuration,
  intersectWeekdayLists,
  weekdaysForStaffBasket,
  weekdaysForStaffService,
} from "@/lib/rules";
import { makeService, makeWorkingHour } from "./fixtures";

describe("weekdaysForStaffService", () => {
  const wedOnly = makeService({ availableWeekdays: [3] });
  const anyDay = makeService({ availableWeekdays: null });

  it("falls back to service rule when no staff row", () => {
    expect(weekdaysForStaffService(wedOnly, undefined, false)).toEqual([3]);
    expect(weekdaysForStaffService(anyDay, undefined, false)).toBeNull();
  });

  it("uses staff rule alone when service is unrestricted", () => {
    expect(weekdaysForStaffService(anyDay, [1, 5], true)).toEqual([1, 5]);
    expect(weekdaysForStaffService(anyDay, null, true)).toBeNull();
  });

  it("intersects staff and service rules when both restrict", () => {
    expect(weekdaysForStaffService(wedOnly, [1, 3, 5], true)).toEqual([3]);
    expect(weekdaysForStaffService(wedOnly, [1, 5], true)).toEqual([]);
  });
});

describe("weekdaysForStaffBasket", () => {
  it("intersects per-service effective rules for one staff member", () => {
    const lashes = makeService({ id: "svc_lash", availableWeekdays: [1, 3, 5] });
    const brows = makeService({ id: "svc_brow", availableWeekdays: null });
    expect(
      weekdaysForStaffBasket([lashes, brows], {
        svc_lash: [3, 5],
        // brows has no staff row
      }),
    ).toEqual([3, 5]);
  });
});

describe("intersectWeekdayLists", () => {
  it("returns null when every list is unrestricted", () => {
    expect(intersectWeekdayLists([null, [], undefined])).toBeNull();
  });
});

describe("daySlots respects per-staff day rules", () => {
  const service = makeService({ availableWeekdays: [1, 2, 3, 4, 5] }); // weekdays
  const ctxBase = {
    workingHours: [0, 1, 2, 3, 4, 5, 6].map((weekday) =>
      makeWorkingHour({ weekday, enabled: true }),
    ),
    timeOff: [],
    bookings: [],
  };
  const now = Date.parse("2030-01-01T00:00:00.000Z");

  it("blocks a weekday the staff cannot offer even if the service can", () => {
    // Staff only does Wednesdays; service allows Mon–Fri.
    const allowed = weekdaysForStaffService(service, [3], true);
    // 2030-07-11 is Thursday
    expect(
      daySlotsForDuration(60, "2030-07-11", { ...ctxBase, allowedWeekdays: allowed }, now),
    ).toEqual([]);
    // 2030-07-10 is Wednesday
    expect(
      daySlotsForDuration(60, "2030-07-10", { ...ctxBase, allowedWeekdays: allowed }, now).length,
    ).toBeGreaterThan(0);
  });

  it("still uses service-level daySlots when no staff rule", () => {
    const restricted = makeService({ availableWeekdays: [3] });
    expect(daySlots(restricted, "2030-07-10", ctxBase, now).length).toBeGreaterThan(0);
    expect(daySlots(restricted, "2030-07-11", ctxBase, now)).toEqual([]);
  });
});
