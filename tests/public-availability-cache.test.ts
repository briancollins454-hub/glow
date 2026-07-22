import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
const fetchCalls: string[] = [];

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  revalidateTag,
}));

vi.mock("@/lib/supabase/service", () => ({
  supabaseService: () => ({}),
}));

vi.mock("@/lib/db/queries", () => ({
  listWorkingHours: vi.fn(async () => {
    fetchCalls.push("hours");
    return [];
  }),
  listTimeOff: vi.fn(async () => {
    fetchCalls.push("timeOff");
    return [];
  }),
  listBlockingBookingsInRange: vi.fn(async (_sb: unknown, techId: string) => {
    fetchCalls.push(`bookings:${techId}`);
    return [{ id: "bk_cached", techId, startIso: "2026-07-22T10:00:00.000Z" }];
  }),
  listRotaHours: vi.fn(async () => {
    fetchCalls.push("rota");
    return [];
  }),
  listServices: vi.fn(async () => {
    fetchCalls.push("services");
    return [];
  }),
  listStaff: vi.fn(async () => {
    fetchCalls.push("staff");
    return [];
  }),
  staffServiceMap: vi.fn(async () => ({})),
  staffServiceDayMap: vi.fn(async () => ({})),
}));

vi.mock("@/lib/rota", () => ({
  currentWeekStartLondon: () => "2026-07-20",
  addDaysToDateStr: (d: string, n: number) => d,
}));

describe("public availability cache", () => {
  beforeEach(() => {
    fetchCalls.length = 0;
    revalidateTag.mockClear();
    vi.resetModules();
  });

  it("returns fresh blocking bookings after a booking mutation invalidates the tag", async () => {
    const cache = await import("@/lib/booking/public-availability-cache");
    const queries = await import("@/lib/db/queries");

    const first = await cache.getCachedPublicAvailabilityBundle("tech_1");
    expect(first.bookings[0]?.id).toBe("bk_cached");
    expect(fetchCalls.filter((c) => c.startsWith("bookings:")).length).toBe(1);

    // Simulate a create/cancel/reschedule: bust the tag, then fresh load sees new rows.
    cache.revalidatePublicAvailability("tech_1");
    expect(revalidateTag).toHaveBeenCalledWith("public-availability-tech_1");

    vi.mocked(queries.listBlockingBookingsInRange).mockResolvedValueOnce([
      {
        id: "bk_fresh",
        techId: "tech_1",
        startIso: "2026-07-22T11:00:00.000Z",
      } as never,
    ]);

    const fresh = await cache.loadFreshBlockingBookings("tech_1");
    expect(fresh[0]?.id).toBe("bk_fresh");

    // Fresh path is intentionally uncached (extra query after invalidation path).
    expect(fetchCalls.filter((c) => c.startsWith("bookings:")).length).toBeGreaterThanOrEqual(2);
  });

  it("narrows the public bookings select away from select(*)", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.promises.readFile("lib/db/queries.ts", "utf8"),
    );
    expect(src).toMatch(
      /listBlockingBookingsInRange[\s\S]*?\.select\("id, techId, startIso, endIso, status, staffId, serviceId, clientId"\)/,
    );
    expect(src).not.toMatch(
      /listBlockingBookingsInRange[\s\S]{0,400}\.select\("\*"\)/,
    );
  });
});
