import { describe, expect, it } from "vitest";
import {
  UNCATEGORISED_ID,
  defaultOpenCategoryId,
  groupServicesForDashboard,
  groupServicesForMenu,
} from "@/lib/booking/service-groups";
import { makeCategory, makeService } from "./fixtures";

describe("groupServicesForMenu", () => {
  const lashes = makeCategory({ id: "cat_lashes", name: "Lashes" });
  const brows = makeCategory({ id: "cat_brows", name: "Brows" });

  it("groups services under their existing categories", () => {
    const services = [
      makeService({ id: "s1", categoryId: "cat_lashes", name: "Classic Full Set" }),
      makeService({ id: "s2", categoryId: "cat_brows", name: "Brow Lamination" }),
      makeService({ id: "s3", categoryId: "cat_lashes", name: "Infill" }),
    ];

    const groups = groupServicesForMenu([lashes, brows], services);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ id: "cat_lashes", title: "Lashes" });
    expect(groups[0]!.services.map((s) => s.id)).toEqual(["s1", "s3"]);
    expect(groups[1]).toMatchObject({ id: "cat_brows", title: "Brows" });
    expect(groups[1]!.services.map((s) => s.id)).toEqual(["s2"]);
  });

  it("puts orphaned services in a fallback group without losing them", () => {
    const services = [makeService({ id: "s1", categoryId: "deleted_cat", name: "Old Service" })];

    const groups = groupServicesForMenu([lashes], services);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.id).toBe(UNCATEGORISED_ID);
    expect(groups[0]!.services).toHaveLength(1);
  });

  it("skips empty categories", () => {
    const groups = groupServicesForMenu([lashes, brows], [
      makeService({ categoryId: "cat_lashes" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.id).toBe("cat_lashes");
  });

  it("preserves service order from the caller", () => {
    const services = [
      makeService({ id: "s2", categoryId: "cat_lashes", sortOrder: 2 }),
      makeService({ id: "s1", categoryId: "cat_lashes", sortOrder: 1 }),
    ];
    const groups = groupServicesForMenu([lashes], services);
    expect(groups[0]!.services.map((s) => s.id)).toEqual(["s2", "s1"]);
  });
});

describe("groupServicesForDashboard", () => {
  const lashes = makeCategory({ id: "cat_lashes", name: "Lashes" });
  const brows = makeCategory({ id: "cat_brows", name: "Brows" });

  it("includes inactive and patch-test services", () => {
    const services = [
      makeService({ id: "s1", categoryId: "cat_lashes", active: false }),
      makeService({ id: "s2", categoryId: "cat_brows", isPatchTestService: true }),
    ];
    const groups = groupServicesForDashboard([lashes, brows], services);
    expect(groups).toHaveLength(2);
    expect(groups.flatMap((g) => g.services.map((s) => s.id)).sort()).toEqual(["s1", "s2"]);
  });
});

describe("defaultOpenCategoryId", () => {
  it("auto-opens when a tech only has one category group", () => {
    expect(
      defaultOpenCategoryId([{ id: "cat_lashes", title: "Lashes", services: [makeService()] }]),
    ).toBe("cat_lashes");
  });

  it("starts collapsed when multiple category groups exist", () => {
    expect(
      defaultOpenCategoryId([
        { id: "a", title: "A", services: [makeService()] },
        { id: "b", title: "B", services: [makeService()] },
      ]),
    ).toBeNull();
  });
});
