import { describe, expect, it } from "vitest";
import { findInfillForCompletedService } from "@/lib/infill-nudge";
import { makeService } from "./fixtures";

describe("findInfillForCompletedService", () => {
  const fullSet = makeService({ id: "svc_full", name: "Classic Full Set", isInfill: false });
  const infillLinked = makeService({
    id: "svc_infill",
    name: "Classic Infill",
    isInfill: true,
    fullSetServiceId: "svc_full",
  });
  const infillOther = makeService({
    id: "svc_infill2",
    name: "Volume Infill",
    isInfill: true,
    categoryId: "cat_2",
  });

  it("returns linked infill service for a full set", () => {
    expect(findInfillForCompletedService([fullSet, infillLinked], fullSet)?.id).toBe("svc_infill");
  });

  it("returns sole category infill when no explicit link", () => {
    const loneInfill = makeService({ id: "svc_li", isInfill: true, categoryId: "cat_1" });
    expect(findInfillForCompletedService([fullSet, loneInfill], fullSet)?.id).toBe("svc_li");
  });

  it("returns null for infill or patch test services", () => {
    expect(findInfillForCompletedService([infillLinked], infillLinked)).toBeNull();
    const patch = makeService({ isPatchTestService: true });
    expect(findInfillForCompletedService([patch], patch)).toBeNull();
  });

  it("returns null when multiple infills share a category", () => {
    const a = makeService({ id: "a", isInfill: true, categoryId: "cat_1" });
    const b = makeService({ id: "b", isInfill: true, categoryId: "cat_1" });
    expect(findInfillForCompletedService([fullSet, a, b], fullSet)).toBeNull();
  });

  it("ignores inactive infill services", () => {
    const inactive = makeService({
      id: "svc_off",
      isInfill: true,
      fullSetServiceId: "svc_full",
      active: false,
    });
    expect(findInfillForCompletedService([fullSet, inactive], fullSet)).toBeNull();
  });
});
