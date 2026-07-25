import { describe, expect, it } from "vitest";
import {
  ALL_SERVICES_PACK_NAME,
  buildPackScopeIndex,
  filterQuestionsForServices,
  groupQuestionsByPack,
  packAppliesToService,
  packScopeLabel,
  parsePackTargetsFromForm,
  questionAppliesWithPacks,
} from "@/lib/booking/consultation-scope";
import type {
  ConsultationPack,
  ConsultationPackTarget,
  ConsultationQuestion,
} from "@/lib/db/types";
import { makeService } from "./fixtures";

function makePack(overrides: Partial<ConsultationPack> = {}): ConsultationPack {
  return {
    id: "cfp_1",
    techId: "tech_1",
    name: "Piercing consultation",
    sortOrder: 0,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTarget(
  overrides: Partial<ConsultationPackTarget> & Pick<ConsultationPackTarget, "packId">,
): ConsultationPackTarget {
  return {
    id: "cpt_1",
    categoryId: null,
    serviceId: null,
    ...overrides,
  };
}

function makeQuestion(overrides: Partial<ConsultationQuestion> = {}): ConsultationQuestion {
  return {
    id: "q_1",
    techId: "tech_1",
    prompt: "Any allergies?",
    type: "text",
    required: true,
    sortOrder: 0,
    active: true,
    categoryId: null,
    serviceId: null,
    packId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("consultation form packs", () => {
  const piercing = makeService({ id: "svc_pierce", categoryId: "cat_pierce", name: "Lobe" });
  const helix = makeService({ id: "svc_helix", categoryId: "cat_pierce", name: "Helix" });
  const lashes = makeService({ id: "svc_lash", categoryId: "cat_lash", name: "Lashes" });
  const plasma = makeService({ id: "svc_plasma", categoryId: "cat_plasma", name: "Plasma" });

  const allPack = makePack({ id: "cfp_all", name: ALL_SERVICES_PACK_NAME });
  const piercePack = makePack({ id: "cfp_pierce", name: "Piercing consultation" });
  const multiPack = makePack({ id: "cfp_multi", name: "High-risk treatments" });

  const targets: ConsultationPackTarget[] = [
    makeTarget({ id: "t1", packId: "cfp_pierce", categoryId: "cat_pierce" }),
    makeTarget({ id: "t2", packId: "cfp_multi", categoryId: "cat_pierce" }),
    makeTarget({ id: "t3", packId: "cfp_multi", categoryId: "cat_plasma" }),
  ];

  const index = buildPackScopeIndex([allPack, piercePack, multiPack], targets);

  const globalQ = makeQuestion({ id: "q_global", packId: "cfp_all", prompt: "Allergies?" });
  const pierceQ = makeQuestion({ id: "q_pierce", packId: "cfp_pierce", prompt: "Metal preference?" });
  const multiQ = makeQuestion({ id: "q_multi", packId: "cfp_multi", prompt: "Medical history?" });

  it("pack with no targets applies to every service (All services form)", () => {
    expect(packAppliesToService([], piercing)).toBe(true);
    expect(packAppliesToService([], lashes)).toBe(true);
  });

  it("category-targeted pack covers every service in that category — no per-service rewrite", () => {
    expect(questionAppliesWithPacks(pierceQ, piercing, index)).toBe(true);
    expect(questionAppliesWithPacks(pierceQ, helix, index)).toBe(true);
    expect(questionAppliesWithPacks(pierceQ, lashes, index)).toBe(false);
  });

  it("one pack can target multiple categories (piercings + plasma, not lashes)", () => {
    expect(questionAppliesWithPacks(multiQ, piercing, index)).toBe(true);
    expect(questionAppliesWithPacks(multiQ, plasma, index)).toBe(true);
    expect(questionAppliesWithPacks(multiQ, lashes, index)).toBe(false);
  });

  it("booking for a piercing shows global + piercing packs, not lash-only content", () => {
    const shown = filterQuestionsForServices(
      [globalQ, pierceQ, multiQ],
      [piercing],
      index,
    );
    expect(shown.map((q) => q.id).sort()).toEqual(["q_global", "q_multi", "q_pierce"].sort());
  });

  it("basket of lash + piercing unions both without duplicating shared questions", () => {
    const shown = filterQuestionsForServices(
      [globalQ, pierceQ, multiQ],
      [lashes, piercing],
      index,
    );
    expect(shown.map((q) => q.id).sort()).toEqual(["q_global", "q_multi", "q_pierce"].sort());
    expect(new Set(shown.map((q) => q.id)).size).toBe(shown.length);
  });

  it("service-specific target still works for awkward subsets", () => {
    const subsetPack = makePack({ id: "cfp_subset", name: "Cartilage only" });
    const subsetTargets = [
      makeTarget({ id: "ts", packId: "cfp_subset", serviceId: "svc_helix" }),
    ];
    const subsetIndex = buildPackScopeIndex([subsetPack], subsetTargets);
    const q = makeQuestion({ id: "q_sub", packId: "cfp_subset" });
    expect(questionAppliesWithPacks(q, helix, subsetIndex)).toBe(true);
    expect(questionAppliesWithPacks(q, piercing, subsetIndex)).toBe(false);
  });

  it("parses multi-select form targets; all means empty target list", () => {
    expect(parsePackTargetsFromForm(["all"])).toEqual([]);
    expect(parsePackTargetsFromForm(["category:cat_pierce", "category:cat_plasma", "service:svc_helix"])).toEqual([
      { categoryId: "cat_pierce", serviceId: null },
      { categoryId: "cat_plasma", serviceId: null },
      { categoryId: null, serviceId: "svc_helix" },
    ]);
  });

  it("labels pack scope for the dashboard", () => {
    expect(packScopeLabel([])).toBe("All services");
    expect(
      packScopeLabel(targets.filter((t) => t.packId === "cfp_multi"), {
        categoryName: (id) => (id === "cat_pierce" ? "Piercings" : "Plasma"),
      }),
    ).toBe("Piercings · Plasma");
  });

  it("groups questions under packs for the forms page", () => {
    const grouped = groupQuestionsByPack(
      [piercePack, allPack],
      [pierceQ, globalQ, makeQuestion({ id: "orphan", packId: null })],
    );
    expect(grouped[0]?.pack.id).toBe("cfp_pierce");
    expect(grouped[0]?.questions.map((q) => q.id)).toEqual(["q_pierce"]);
    expect(grouped[1]?.pack.id).toBe("cfp_all");
    expect(grouped[1]?.questions.map((q) => q.id)).toEqual(["q_global"]);
  });

  it("still honours legacy single-scope questions until migrated", () => {
    const legacy = makeQuestion({
      id: "q_legacy",
      packId: null,
      categoryId: "cat_lash",
      prompt: "Lash glue allergy?",
    });
    const shown = filterQuestionsForServices([legacy, globalQ], [lashes], index);
    expect(shown.map((q) => q.id).sort()).toEqual(["q_global", "q_legacy"].sort());
    expect(filterQuestionsForServices([legacy], [piercing], index)).toEqual([]);
  });
});
