import { describe, expect, it } from "vitest";
import {
  categoryLookupKeys,
  inferServiceCategory,
} from "@/lib/import/service-categories";

describe("inferServiceCategory", () => {
  it("puts Acuity Types into sensible salon categories", () => {
    expect(inferServiceCategory("Classic Lash Extensions (patch test must be at least 24hrs before)")).toBe(
      "Lashes",
    );
    expect(inferServiceCategory("Brow Lamination With Tint  (patch test 48hrs before)")).toBe("Brows");
    expect(inferServiceCategory("Acrylic Rebalance/Infills")).toBe("Nails");
    expect(inferServiceCategory("Basic Pedicure with Gel")).toBe("Toes");
    expect(inferServiceCategory("Brazilian Wax")).toBe("Waxing");
    expect(inferServiceCategory("Luxury Facial")).toBe("Facials");
    expect(inferServiceCategory("Full Body Swedish Massage")).toBe("Massage");
    expect(inferServiceCategory("Anti Wrinkle Injection 2 Areas")).toBe("Injectables");
    expect(inferServiceCategory("Lip Filler 0.5ml")).toBe("Injectables");
    expect(inferServiceCategory("Fat Dissolve Stomach")).toBe("Body Treatments");
    expect(inferServiceCategory("Laser Hair  Removal (FROM £30)")).toBe("Laser");
    expect(inferServiceCategory("Lobe Pair + Addition piercing (price will differ depending on what piercing you want)")).toBe(
      "Piercings",
    );
    expect(inferServiceCategory("Daith")).toBe("Piercings");
    expect(inferServiceCategory("Tooth Gem from £25")).toBe("Tooth Gems");
    expect(inferServiceCategory("Welded Jewellery From £35")).toBe("Welding Jewellery");
    expect(inferServiceCategory("Wash, cut and blow dry")).toBe("Hair");
    expect(inferServiceCategory("Spray Tan")).toBe("Tanning");
    expect(inferServiceCategory("Acrylic Nails Course")).toBe("Courses");
    expect(inferServiceCategory("Consultation")).toBe("Consultations");
    expect(inferServiceCategory("Blemish Removal")).toBe("Body Treatments");
    expect(inferServiceCategory("Lash Lift/Tint & Brow Wax")).toBe("Lashes");
    expect(inferServiceCategory("Lash & Brow Tint")).toBe("Lashes");
    expect(inferServiceCategory("Henna Brows & Wax")).toBe("Brows");
    expect(inferServiceCategory("Brow Wax")).toBe("Brows");
    expect(inferServiceCategory("Arm Wax")).toBe("Waxing");
    expect(inferServiceCategory("Full set of Acrylics with Claire only")).toBe("Nails");
    expect(inferServiceCategory("Express Facial & Gel Polish")).toBe("Facials");
  });

  it("falls back to Other for unknowns", () => {
    expect(inferServiceCategory("Room out of use")).toBe("Other");
    expect(inferServiceCategory("Mystery Thing")).toBe("Other");
  });
});

describe("categoryLookupKeys", () => {
  it("matches jewellery spelling variants", () => {
    expect(categoryLookupKeys("Welding Jewellery")).toEqual([
      "welding jewellery",
      "welding jewelery",
    ]);
    expect(categoryLookupKeys("Welding Jewelery")).toEqual([
      "welding jewellery",
      "welding jewelery",
    ]);
  });
});
