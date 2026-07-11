import { describe, expect, it } from "vitest";
import { filterLateCascadeBookings } from "@/lib/running-late-filter";
import { makeBooking } from "./fixtures";

describe("filterLateCascadeBookings", () => {
  const today = "2026-07-10";
  const now = new Date("2026-07-10T14:00:00.000Z").getTime();

  it("includes confirmed appointments still to come today", () => {
    const bookings = [
      makeBooking({
        id: "b1",
        startIso: "2026-07-10T15:00:00.000Z",
        endIso: "2026-07-10T16:00:00.000Z",
        status: "confirmed",
      }),
    ];
    expect(filterLateCascadeBookings(bookings, today, now)).toHaveLength(1);
  });

  it("excludes completed and cancelled bookings", () => {
    const bookings = [
      makeBooking({
        startIso: "2026-07-10T15:00:00.000Z",
        endIso: "2026-07-10T16:00:00.000Z",
        status: "completed",
      }),
      makeBooking({
        id: "b2",
        startIso: "2026-07-10T16:00:00.000Z",
        endIso: "2026-07-10T17:00:00.000Z",
        status: "cancelled",
      }),
    ];
    expect(filterLateCascadeBookings(bookings, today, now)).toHaveLength(0);
  });

  it("excludes appointments that already finished", () => {
    const bookings = [
      makeBooking({
        startIso: "2026-07-10T12:00:00.000Z",
        endIso: "2026-07-10T13:00:00.000Z",
        status: "confirmed",
      }),
    ];
    expect(filterLateCascadeBookings(bookings, today, now)).toHaveLength(0);
  });

  it("includes appointments that started within the grace window", () => {
    const bookings = [
      makeBooking({
        startIso: "2026-07-10T13:45:00.000Z",
        endIso: "2026-07-10T15:00:00.000Z",
        status: "confirmed",
      }),
    ];
    expect(filterLateCascadeBookings(bookings, today, now)).toHaveLength(1);
  });
});
