import { describe, expect, it, vi, beforeEach } from "vitest";
import { taxPackFilename, loadTaxPackData } from "@/lib/tax-pack";
import {
  selectableTaxYears,
  taxYearRange,
  taxYearStartForDate,
} from "@/lib/tax-year";
import { makeBooking, makeClient, makePayment, makeService, makeTech } from "./fixtures";

const listPayments = vi.fn();
const listBookings = vi.fn();
const listClients = vi.fn();
const listServices = vi.fn();

vi.mock("@/lib/db/queries", () => ({
  listPayments: (...args: unknown[]) => listPayments(...args),
  listBookings: (...args: unknown[]) => listBookings(...args),
  listClients: (...args: unknown[]) => listClients(...args),
  listServices: (...args: unknown[]) => listServices(...args),
}));

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

describe("loadTaxPackData refunds", () => {
  beforeEach(() => {
    listPayments.mockReset();
    listBookings.mockReset();
    listClients.mockReset();
    listServices.mockReset();
  });

  it("subtracts kind refund from totalIncome", async () => {
    const tech = makeTech();
    listPayments.mockResolvedValue([
      makePayment({
        id: "pay_dep",
        kind: "deposit",
        amountPennies: 1500,
        createdAt: "2025-06-01T10:00:00.000Z",
        providerRef: "pi_1",
      }),
      makePayment({
        id: "pay_bal",
        kind: "balance",
        amountPennies: 3500,
        createdAt: "2025-06-01T11:00:00.000Z",
        providerRef: "pi_2",
      }),
      makePayment({
        id: "pay_ref",
        kind: "refund",
        amountPennies: 1500,
        createdAt: "2025-06-02T10:00:00.000Z",
        providerRef: "pi_1",
      }),
    ]);
    listBookings.mockResolvedValue([makeBooking()]);
    listClients.mockResolvedValue([makeClient()]);
    listServices.mockResolvedValue([makeService()]);

    const data = await loadTaxPackData({} as never, tech, 2025);
    expect(data.depositsTotal).toBe(1500);
    expect(data.balancesTotal).toBe(3500);
    expect(data.refundsTotal).toBe(1500);
    expect(data.totalIncome).toBe(3500);
  });
});
