import { describe, expect, it } from "vitest";
import { checkLimit } from "@/lib/rate-limit";

describe("checkLimit", () => {
  it("allows up to the limit then blocks", () => {
    const key = `test-${Math.random()}`;
    const now = 1_000_000;
    expect(checkLimit(key, 3, 60_000, now)).toBe(true);
    expect(checkLimit(key, 3, 60_000, now)).toBe(true);
    expect(checkLimit(key, 3, 60_000, now)).toBe(true);
    expect(checkLimit(key, 3, 60_000, now)).toBe(false);
  });

  it("resets after the window passes", () => {
    const key = `test-${Math.random()}`;
    const now = 1_000_000;
    expect(checkLimit(key, 1, 60_000, now)).toBe(true);
    expect(checkLimit(key, 1, 60_000, now + 1)).toBe(false);
    expect(checkLimit(key, 1, 60_000, now + 60_001)).toBe(true);
  });

  it("tracks keys independently", () => {
    const a = `test-${Math.random()}`;
    const b = `test-${Math.random()}`;
    const now = 1_000_000;
    expect(checkLimit(a, 1, 60_000, now)).toBe(true);
    expect(checkLimit(b, 1, 60_000, now)).toBe(true);
  });
});
