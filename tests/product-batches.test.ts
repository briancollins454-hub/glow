import { describe, expect, it } from "vitest";
import { productTypeLabel, severityLabel } from "@/lib/product-batches";

describe("product-batches labels", () => {
  it("maps product types to readable labels", () => {
    expect(productTypeLabel("adhesive")).toBe("Adhesive");
    expect(productTypeLabel("tint")).toBe("Tint");
    expect(productTypeLabel("lift")).toBe("Lift solution");
    expect(productTypeLabel("other")).toBe("Other");
  });

  it("maps severity to readable labels", () => {
    expect(severityLabel("mild")).toBe("Mild");
    expect(severityLabel("moderate")).toBe("Moderate");
    expect(severityLabel("severe")).toBe("Severe");
  });
});

describe("logProductUsage validation", () => {
  it("requires patch test or booking link", async () => {
    const { logProductUsage } = await import("@/lib/product-batches");
    const fakeSb = {} as never;
    await expect(
      logProductUsage(fakeSb, "tech_1", { batchId: "bat_1", clientId: "cli_1" }),
    ).rejects.toThrow("Link the usage to a patch test or booking.");
  });
});
