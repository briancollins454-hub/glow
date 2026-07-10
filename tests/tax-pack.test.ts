import { describe, expect, it } from "vitest";
import { taxPackFilename } from "@/lib/tax-pack";
import {
  selectableTaxYears,
  taxYearRange,
  taxYearStartForDate,
} from "@/lib/tax-year";
import { makeTech } from "./fixtures";

describe("taxYearStartForDate", () => {
  it("uses previous calendar year before 6 April", () => {
    expect(taxYearStartForDate(new Date("2026-04-05T12:00:00.000Z"))).toBe(2025);
  });

  it("uses current calendar year from 6 April onwards", () => {
    expect(taxYearStartForDate(new Date("2026-04-06T12:00:00.000Z"))).toBe(2026);
  });
});

describe("taxYearRange", () => {
  it("labels UK tax years correctly", () => {
    expect(taxYearRange(2025).label).toBe("2025/26");
  });
});

describe("selectableTaxYears", () => {
  it("returns current year and two prior", () => {
    const years = selectableTaxYears(new Date("2026-07-10T12:00:00.000Z"));
    expect(years).toHaveLength(3);
    expect(years[0]!.startYear).toBe(2026);
    expect(years[1]!.startYear).toBe(2025);
    expect(years[2]!.startYear).toBe(2024);
  });
});

describe("taxPackFilename", () => {
  it("includes business name and tax year", () => {
    const name = taxPackFilename(
      makeTech({ businessName: "Bella Rose Beauty" }),
      taxYearRange(2025),
      new Date("2026-07-10T12:00:00.000Z"),
    );
    expect(name).toBe("self-assessment-Bella-Rose-Beauty-2025-26-2026-07-10.pdf");
  });
});
