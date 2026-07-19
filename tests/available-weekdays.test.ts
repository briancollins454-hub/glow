import { describe, expect, it } from "vitest";
import {
  daySlots,
  intersectWeekdays,
  normalizeAvailableWeekdays,
} from "@/lib/rules";
import { makeService, makeWorkingHour } from "./fixtures";

describe("normalizeAvailableWeekdays", () => {
  it("treats empty / all seven as unrestricted", () => {
    expect(normalizeAvailableWeekdays(null)).toBeNull();
    expect(normalizeAvailableWeekdays([])).toBeNull();
    expect(normalizeAvailableWeekdays([0, 1, 2, 3, 4, 5, 6])).toBeNull();
  });

  it("keeps a sorted unique subset", () => {
    expect(normalizeAvailableWeekdays([5, 1, 5, 99])).toEqual([1, 5]);
  });
});

describe("intersectWeekdays", () => {
  it("ignores unrestricted services", () => {
    expect(
      intersectWeekdays([
        makeService({ availableWeekdays: null }),
        makeService({ availableWeekdays: [5] }),
      ]),
    ).toEqual([5]);
  });

  it("intersects multiple restrictions", () => {
    expect(
      intersectWeekdays([
        makeService({ availableWeekdays: [1, 3, 5] }),
        makeService({ availableWeekdays: [3, 5, 6] }),
      ]),
    ).toEqual([3, 5]);
  });
});

describe("daySlots respects availableWeekdays", () => {
  const service = makeService({ availableWeekdays: [3] }); // Wednesday only
  const ctx = {
    workingHours: [0, 1, 2, 3, 4, 5, 6].map((weekday) =>
      makeWorkingHour({ weekday, enabled: true }),
    ),
    timeOff: [],
    bookings: [],
  };
  const now = Date.parse("2030-01-01T00:00:00.000Z");

  it("offers slots on an allowed weekday", () => {
    // 2030-07-10 is Wednesday
    const slots = daySlots(service, "2030-07-10", ctx, now);
    expect(slots.length).toBeGreaterThan(0);
  });

  it("blocks slots on other weekdays", () => {
    // 2030-07-11 is Thursday
    expect(daySlots(service, "2030-07-11", ctx, now)).toEqual([]);
  });
});
