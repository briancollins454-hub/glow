import { describe, expect, it } from "vitest";
import {
  buildQuestionScopeOptions,
  filterQuestionScopeOptions,
  parseQuestionScope,
  questionScopeSelectionLabel,
} from "@/lib/booking/consultation-scope";

function makeLargeCatalog() {
  const categories = Array.from({ length: 13 }, (_, i) => ({
    id: `cat_${i + 1}`,
    name: i === 0 ? "Piercings" : `Category ${i + 1}`,
  }));
  const services = Array.from({ length: 122 }, (_, i) => ({
    id: `svc_${i + 1}`,
    name:
      i === 87
        ? "Helix piercing — titanium"
        : i === 0
          ? "Classic lashes"
          : `Service ${i + 1}`,
    active: true,
    categoryId: categories[i % categories.length].id,
  }));
  return { categories, services };
}

describe("question scope combobox options", () => {
  it("builds All + services + categories in that order", () => {
    const { categories, services } = makeLargeCatalog();
    const options = buildQuestionScopeOptions(categories, services);
    expect(options[0]).toEqual({ value: "all", label: "All services", kind: "all" });
    expect(options[1]?.kind).toBe("service");
    expect(options.filter((o) => o.kind === "service")).toHaveLength(122);
    expect(options.filter((o) => o.kind === "category")).toHaveLength(13);
    expect(options).toHaveLength(1 + 13 + 122);
    // First service appears before any category so large menus aren't buried.
    const firstCategoryIdx = options.findIndex((o) => o.kind === "category");
    const firstServiceIdx = options.findIndex((o) => o.kind === "service");
    expect(firstServiceIdx).toBeGreaterThan(0);
    expect(firstServiceIdx).toBeLessThan(firstCategoryIdx);
  });

  it("shows services immediately when opening (not only after scrolling past categories)", () => {
    const { categories, services } = makeLargeCatalog();
    const options = buildQuestionScopeOptions(categories, services);
    const visibleWithoutScroll = options.slice(0, 8);
    expect(visibleWithoutScroll.some((o) => o.kind === "service")).toBe(true);
    expect(visibleWithoutScroll.every((o) => o.kind !== "category")).toBe(true);
  });

  it("finds a specific service among 122 by typing", () => {
    const { categories, services } = makeLargeCatalog();
    const options = buildQuestionScopeOptions(categories, services);
    const filtered = filterQuestionScopeOptions(options, "helix titanium");
    // "All services" stays pinned; the matching service appears.
    expect(filtered.some((o) => o.kind === "all")).toBe(true);
    const hit = filtered.find((o) => o.kind === "service");
    expect(hit?.value).toBe("service:svc_88");
    expect(hit?.label).toBe("Helix piercing — titanium");
    // Unrelated services are excluded.
    expect(filtered.filter((o) => o.kind === "service")).toHaveLength(1);
  });

  it("still finds categories by typing", () => {
    const { categories, services } = makeLargeCatalog();
    const options = buildQuestionScopeOptions(categories, services);
    const filtered = filterQuestionScopeOptions(options, "pierc");
    expect(filtered.find((o) => o.kind === "category")?.value).toBe("category:cat_1");
    expect(filtered.find((o) => o.kind === "category")?.label).toBe("Piercings");
  });

  it("keeps All services available with empty or matching query", () => {
    const { categories, services } = makeLargeCatalog();
    const options = buildQuestionScopeOptions(categories, services);
    expect(filterQuestionScopeOptions(options, "")[0]?.value).toBe("all");
    expect(filterQuestionScopeOptions(options, "zzz-no-match")[0]?.value).toBe("all");
    expect(filterQuestionScopeOptions(options, "zzz-no-match")).toHaveLength(1);
  });

  it("selection label and parse persist the correct scope value", () => {
    const { categories, services } = makeLargeCatalog();
    const options = buildQuestionScopeOptions(categories, services);

    expect(questionScopeSelectionLabel("all", options)).toBe("All services");
    expect(parseQuestionScope("all")).toEqual({ categoryId: null, serviceId: null });

    expect(questionScopeSelectionLabel("category:cat_1", options)).toBe("Piercings");
    expect(parseQuestionScope("category:cat_1")).toEqual({
      categoryId: "cat_1",
      serviceId: null,
    });

    expect(questionScopeSelectionLabel("service:svc_88", options)).toBe(
      "Helix piercing — titanium",
    );
    expect(parseQuestionScope("service:svc_88")).toEqual({
      categoryId: null,
      serviceId: "svc_88",
    });
  });

  it("omits inactive services from the picker list", () => {
    const options = buildQuestionScopeOptions(
      [{ id: "cat_1", name: "Piercings" }],
      [
        { id: "svc_a", name: "Active lobe", active: true },
        { id: "svc_b", name: "Retired", active: false },
      ],
    );
    expect(options.filter((o) => o.kind === "service").map((o) => o.value)).toEqual([
      "service:svc_a",
    ]);
  });
});
