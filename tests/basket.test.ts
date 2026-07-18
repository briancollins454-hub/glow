import { describe, expect, it } from "vitest";
import {
  basketAmounts,
  basketDurationMin,
  basketStartTimes,
  daySlotsForDuration,
} from "@/lib/rules";
import { resolveBasketExtras, addableBasketServices } from "@/lib/booking/basket";
import { makeBooking, makeService, makeTech, makeWorkingHour } from "./fixtures";

const tech = makeTech();

const lashes = makeService({ id: "svc_lash", durationMin: 90, pricePennies: 6000 });
const brows = makeService({ id: "svc_brow", durationMin: 30, pricePennies: 2000 });
const nails = makeService({ id: "svc_nail", durationMin: 45, pricePennies: 3000 });
const patchTestSvc = makeService({ id: "svc_patch", isPatchTestService: true });

describe("basketDurationMin", () => {
  it("sums treatment durations", () => {
    expect(basketDurationMin([lashes, brows])).toBe(120);
    expect(basketDurationMin([lashes])).toBe(90);
  });
});

describe("basketStartTimes", () => {
  it("chains treatments back-to-back from the chosen slot", () => {
    const starts = basketStartTimes([lashes, brows, nails], "2026-06-03T10:00:00.000Z");
    expect(starts).toEqual([
      "2026-06-03T10:00:00.000Z",
      "2026-06-03T11:30:00.000Z", // after 90min lashes
      "2026-06-03T12:00:00.000Z", // after 30min brows
    ]);
  });
});

describe("basketAmounts", () => {
  it("sums prices and per-treatment deposits", () => {
    // 30% deposits: lashes £18 of £60, brows £6 of £20.
    const a = basketAmounts([lashes, brows], tech, "low");
    expect(a.price).toBe(8000);
    expect(a.deposit).toBe(1800 + 600);
    expect(a.balance).toBe(8000 - 2400);
  });

  it("applies add-ons and discounts to the primary treatment only", () => {
    const addons = [{ name: "Extra volume", pricePennies: 1000 }];
    const a = basketAmounts([lashes, brows], tech, "low", addons, 500);
    // Primary: £60 + £10 - £5 = £65; brows £20 → total £85.
    expect(a.price).toBe(6500 + 2000);
    // Deposits stay on base service prices (add-ons are paid on the day),
    // matching single-booking behaviour: 30% of £60 + 30% of £20.
    expect(a.deposit).toBe(1800 + 600);
    expect(a.balance).toBe(8500 - 2400);
  });

  it("raises deposits with risk tier like single bookings", () => {
    const low = basketAmounts([lashes, brows], tech, "low");
    const high = basketAmounts([lashes, brows], tech, "high");
    expect(high.deposit).toBeGreaterThan(low.deposit);
    // High tier defaults to 100% of price.
    expect(high.deposit).toBe(8000);
  });
});

describe("daySlotsForDuration", () => {
  // Wednesday 2026-06-03, working 09:00-17:00 UK time (BST = UTC+1).
  const ctx = {
    workingHours: [makeWorkingHour({ weekday: 3 })],
    timeOff: [],
    bookings: [
      makeBooking({
        status: "confirmed",
        startIso: "2026-06-03T11:00:00.000Z", // 12:00 local
        endIso: "2026-06-03T12:00:00.000Z", // 13:00 local
      }),
    ],
  };
  const nowMs = new Date("2026-06-01T00:00:00.000Z").getTime();

  it("only offers starts where the whole visit fits before existing bookings", () => {
    const short = daySlotsForDuration(60, "2026-06-03", ctx, nowMs);
    const long = daySlotsForDuration(180, "2026-06-03", ctx, nowMs);

    // 11:00 local start (10:00Z) fits a 60-min visit before the 12:00 booking...
    expect(short).toContain("2026-06-03T10:00:00.000Z");
    // ...but not a 3-hour visit (would overlap it).
    expect(long).not.toContain("2026-06-03T10:00:00.000Z");
    // A 3-hour visit fits right after the booking ends (13:00 local).
    expect(long).toContain("2026-06-03T12:00:00.000Z");
  });

  it("stops offering starts that would run past closing", () => {
    const slots = daySlotsForDuration(180, "2026-06-03", ctx, nowMs);
    // Last possible 3-hour start is 14:00 local (13:00Z) for a 17:00 close.
    expect(slots).toContain("2026-06-03T13:00:00.000Z");
    expect(slots).not.toContain("2026-06-03T13:15:00.000Z");
  });
});

describe("resolveBasketExtras", () => {
  const all = [lashes, brows, nails, patchTestSvc];

  it("keeps valid extras in order and drops junk", () => {
    const extras = resolveBasketExtras(all, lashes.id, `${brows.id},${nails.id}`);
    expect(extras.map((s) => s.id)).toEqual([brows.id, nails.id]);
  });

  it("drops duplicates, the primary itself, unknown ids and patch-test services", () => {
    const extras = resolveBasketExtras(
      all,
      lashes.id,
      `${lashes.id},${brows.id},${brows.id},svc_nope,${patchTestSvc.id}`,
    );
    expect(extras.map((s) => s.id)).toEqual([brows.id]);
  });

  it("drops inactive services", () => {
    const inactive = makeService({ id: "svc_off", active: false });
    const extras = resolveBasketExtras([...all, inactive], lashes.id, "svc_off");
    expect(extras).toEqual([]);
  });

  it("caps the basket size", () => {
    const many = Array.from({ length: 9 }, (_, i) => makeService({ id: `svc_x${i}` }));
    const extras = resolveBasketExtras(
      [lashes, ...many],
      lashes.id,
      many.map((s) => s.id).join(","),
    );
    expect(extras.length).toBe(5);
  });
});

describe("addableBasketServices", () => {
  it("excludes the primary, current extras and patch-test services", () => {
    const addable = addableBasketServices([lashes, brows, nails, patchTestSvc], lashes.id, [brows]);
    expect(addable.map((s) => s.id)).toEqual([nails.id]);
  });
});
