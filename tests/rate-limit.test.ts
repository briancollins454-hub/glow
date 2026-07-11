import { describe, expect, it } from "vitest";
import { checkLimit } from "@/lib/rate-limit";

describe("checkLimit", () => {
  it("allows up to the limit then blocks", () => {
    const key = `test-${Date.now()}-a`;
    const now = 1_000_000;
    expect(checkLimit(key, 3, 60_000, now).ok).toBe(true);
    expect(checkLimit(key, 3, 60_000, now).ok).toBe(true);
    expect(checkLimit(key, 3, 60_000, now).ok).toBe(true);
    expect(checkLimit(key, 3, 60_000, now).ok).toBe(false);
  });

  it("resets after the window slides past old hits", () => {
    const key = `test-${Date.now()}-b`;
    const now = 1_000_000;
    expect(checkLimit(key, 1, 60_000, now).ok).toBe(true);
    expect(checkLimit(key, 1, 60_000, now + 1).ok).toBe(false);
    expect(checkLimit(key, 1, 60_000, now + 60_001).ok).toBe(true);
  });

  it("tracks keys independently", () => {
    const a = `test-${Date.now()}-c`;
    const b = `test-${Date.now()}-d`;
    const now = 1_000_000;
    expect(checkLimit(a, 1, 60_000, now).ok).toBe(true);
    expect(checkLimit(b, 1, 60_000, now).ok).toBe(true);
  });
});
