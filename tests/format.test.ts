import { describe, expect, it } from "vitest";
import { gbp, minutesToLabel, poundsToPennies } from "@/lib/format";

describe("gbp", () => {
  it("formats pennies as pounds", () => {
    expect(gbp(5000)).toBe("£50.00");
    expect(gbp(5550)).toBe("£55.50");
  });
});

describe("poundsToPennies", () => {
  it("parses pound inputs safely", () => {
    expect(poundsToPennies("45")).toBe(4500);
    expect(poundsToPennies("45.50")).toBe(4550);
    expect(poundsToPennies("")).toBe(0);
  });
});

describe("minutesToLabel", () => {
  it("renders human durations", () => {
    expect(minutesToLabel(60)).toBe("1h");
    expect(minutesToLabel(90)).toBe("1h 30m");
    expect(minutesToLabel(45)).toBe("45m");
  });
});
