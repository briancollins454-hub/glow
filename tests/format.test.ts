import { describe, expect, it } from "vitest";
import { minutesToLabel } from "@/lib/format";

describe("minutesToLabel", () => {
  it("renders human durations", () => {
    expect(minutesToLabel(60)).toBe("1h");
    expect(minutesToLabel(90)).toBe("1h 30m");
    expect(minutesToLabel(45)).toBe("45m");
  });
});
