import { describe, expect, it } from "vitest";
import { buildBusinessInsights } from "@/lib/insights";
import { makeBooking, makeClient, makeService } from "./fixtures";

describe("buildBusinessInsights", () => {
  it("flags a quiet week", () => {
    const insights = buildBusinessInsights({ bookings: [], clients: [], payments: [], services: [] });
    expect(insights.some((i) => i.title.includes("quiet"))).toBe(true);
  });

  it("flags outstanding balances on future bookings", () => {
    const future = makeBooking({
      startIso: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      endIso: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 3600000).toISOString(),
      status: "confirmed",
      balanceStatus: "unpaid",
      balancePennies: 3500,
    });
    const insights = buildBusinessInsights({ bookings: [future], clients: [], payments: [], services: [] });
    expect(insights.some((i) => i.title.includes("outstanding"))).toBe(true);
  });

  it("flags no-show clients", () => {
    const insights = buildBusinessInsights({
      bookings: [],
      clients: [makeClient({ noShowCount: 2 })],
      payments: [],
      services: [makeService()],
    });
    expect(insights.some((i) => i.title.includes("no-show"))).toBe(true);
  });

  it("caps at three prompts", () => {
    const insights = buildBusinessInsights({
      bookings: [],
      clients: [makeClient({ noShowCount: 3 })],
      payments: [],
      services: [],
    });
    expect(insights.length).toBeLessThanOrEqual(3);
  });
});
