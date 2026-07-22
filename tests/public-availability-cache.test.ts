import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const revalidateTag = vi.fn();
let bookingRows: { id: string; techId: string; startIso: string }[] = [];

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  revalidateTag,
}));

vi.mock("@/lib/supabase/service", () => ({
  supabaseService: () => ({}),
}));

vi.mock("@/lib/db/queries", () => ({
  listWorkingHours: vi.fn(async () => []),
  listTimeOff: vi.fn(async () => []),
  listBlockingBookingsInRange: vi.fn(async (_sb: unknown, techId: string) =>
    bookingRows.filter((b) => b.techId === techId),
  ),
  listRotaHours: vi.fn(async () => []),
  listServices: vi.fn(async () => []),
  listStaff: vi.fn(async () => []),
  staffServiceMap: vi.fn(async () => ({})),
  staffServiceDayMap: vi.fn(async () => ({})),
}));

vi.mock("@/lib/rota", () => ({
  currentWeekStartLondon: () => "2026-07-20",
  addDaysToDateStr: (d: string) => d,
}));

describe("public availability cache", () => {
  beforeEach(() => {
    revalidateTag.mockClear();
    bookingRows = [
      { id: "bk_cached", techId: "tech_1", startIso: "2026-07-22T10:00:00.000Z" },
    ];
    vi.resetModules();
  });

  it("returns fresh blocking bookings after a booking mutation invalidates the tag", async () => {
    const cache = await import("@/lib/booking/public-availability-cache");

    const first = await cache.getCachedPublicAvailabilityBundle("tech_1");
    expect(first.bookings[0]?.id).toBe("bk_cached");

    // Simulate a create/cancel/reschedule: bust the tag, then the uncached
    // final-slot path must see newly written rows.
    cache.revalidatePublicAvailability("tech_1");
    expect(revalidateTag).toHaveBeenCalledWith("public-availability-tech_1");

    bookingRows = [
      { id: "bk_fresh", techId: "tech_1", startIso: "2026-07-22T11:00:00.000Z" },
    ];

    const fresh = await cache.loadFreshBlockingBookings("tech_1");
    expect(fresh[0]?.id).toBe("bk_fresh");

    // Cached display path would still be stale until Next regenerates; the
    // submit path must not rely on it.
    const stillCachedDisplay = await cache.getCachedPublicAvailabilityBundle("tech_1");
    // In this unit test unstable_cache is a passthrough, so display also
    // refreshes — assert the intentional uncached helper exists and is used
    // from the booking submit action instead.
    expect(stillCachedDisplay).toBeTruthy();
    const actions = readFileSync("app/[handle]/actions.ts", "utf8");
    expect(actions).toMatch(/freshBookings:\s*true/);
    expect(actions).toMatch(/Intentionally uncached/);
  });

  it("narrows the public bookings select away from select(*)", () => {
    const src = readFileSync("lib/db/queries.ts", "utf8");
    const start = src.indexOf("export async function listBlockingBookingsInRange");
    const end = src.indexOf("export async function listBookingsInWindow", start);
    const fn = src.slice(start, end);
    expect(fn).toContain(
      '.select("id, techId, startIso, endIso, status, staffId, serviceId, clientId")',
    );
    expect(fn).not.toContain('.select("*")');
  });
});
