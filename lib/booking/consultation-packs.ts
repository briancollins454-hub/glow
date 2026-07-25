import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ALL_SERVICES_PACK_NAME,
} from "@/lib/booking/consultation-scope";
import {
  createConsultationPack,
  listCategories,
  listConsultationPacks,
  listPackTargetsForTech,
  listQuestions,
  listServices,
  replacePackTargets,
  updateQuestion,
} from "@/lib/db/queries";
import type {
  ConsultationPack,
  ConsultationPackTarget,
  ConsultationQuestion,
  Service,
  ServiceCategory,
} from "@/lib/db/types";

type SB = SupabaseClient;

export type ConsultationFormsBundle = {
  packs: ConsultationPack[];
  targets: ConsultationPackTarget[];
  questions: ConsultationQuestion[];
  categories: ServiceCategory[];
  services: Service[];
};

/**
 * Ensure legacy single-scoped questions live in packs so Claire manages
 * "one form → many services/categories" instead of rewriting questions.
 * Idempotent: questions that already have packId are left alone.
 */
export async function ensureConsultationPacks(
  sb: SB,
  techId: string,
): Promise<ConsultationFormsBundle> {
  const [categories, services, questions] = await Promise.all([
    listCategories(sb, techId),
    listServices(sb, techId),
    listQuestions(sb, techId),
  ]);

  let packs: ConsultationPack[] = [];
  let targets: ConsultationPackTarget[] = [];
  try {
    packs = await listConsultationPacks(sb, techId);
    targets = await listPackTargetsForTech(sb, techId);
  } catch {
    // Migration 0049 not applied yet — fall back to legacy questions only.
    return { packs: [], targets: [], questions, categories, services };
  }

  const unassigned = questions.filter((q) => !q.packId);
  if (unassigned.length === 0) {
    // Still ensure an "All services" pack exists so the UI has a home for globals.
    if (!packs.some((p) => p.name === ALL_SERVICES_PACK_NAME)) {
      try {
        const allPack = await createConsultationPack(sb, {
          techId,
          name: ALL_SERVICES_PACK_NAME,
          sortOrder: 0,
          active: true,
        });
        packs = [...packs, allPack];
      } catch {
        // ignore
      }
    }
    return { packs, targets, questions, categories, services };
  }

  const catById = new Map(categories.map((c) => [c.id, c]));
  const svcById = new Map(services.map((s) => [s.id, s]));
  const packsByKey = new Map<string, ConsultationPack>();

  for (const p of packs) {
    if (p.name === ALL_SERVICES_PACK_NAME) packsByKey.set("all", p);
  }
  for (const t of targets) {
    if (t.categoryId) {
      const pack = packs.find((p) => p.id === t.packId);
      if (pack) packsByKey.set(`category:${t.categoryId}`, pack);
    }
    if (t.serviceId) {
      const pack = packs.find((p) => p.id === t.packId);
      if (pack) packsByKey.set(`service:${t.serviceId}`, pack);
    }
  }

  async function packForKey(
    key: string,
    name: string,
    scope: { categoryId: string | null; serviceId: string | null } | null,
  ): Promise<ConsultationPack> {
    const existing = packsByKey.get(key);
    if (existing) return existing;
    const created = await createConsultationPack(sb, {
      techId,
      name,
      sortOrder: packs.length + packsByKey.size,
      active: true,
    });
    if (scope && (scope.categoryId || scope.serviceId)) {
      await replacePackTargets(sb, created.id, [scope]);
    }
    packsByKey.set(key, created);
    packs = [...packs, created];
    return created;
  }

  for (const q of unassigned) {
    let pack: ConsultationPack;
    if (q.serviceId) {
      const svc = svcById.get(q.serviceId);
      pack = await packForKey(
        `service:${q.serviceId}`,
        svc?.name ? `Service: ${svc.name}` : "Specific service",
        { categoryId: null, serviceId: q.serviceId },
      );
    } else if (q.categoryId) {
      const cat = catById.get(q.categoryId);
      pack = await packForKey(
        `category:${q.categoryId}`,
        cat?.name ?? "Category",
        { categoryId: q.categoryId, serviceId: null },
      );
    } else {
      pack = await packForKey("all", ALL_SERVICES_PACK_NAME, null);
    }
    await updateQuestion(sb, q.id, {
      packId: pack.id,
      categoryId: null,
      serviceId: null,
    });
  }

  const [freshQuestions, freshPacks, freshTargets] = await Promise.all([
    listQuestions(sb, techId),
    listConsultationPacks(sb, techId),
    listPackTargetsForTech(sb, techId),
  ]);

  return {
    packs: freshPacks,
    targets: freshTargets,
    questions: freshQuestions,
    categories,
    services,
  };
}

/** Load packs + targets for public booking filtering (no migration writes). */
export async function loadConsultationScopeBundle(
  sb: SB,
  techId: string,
  opts: { activeOnly?: boolean } = {},
): Promise<{
  questions: ConsultationQuestion[];
  packs: ConsultationPack[];
  targets: ConsultationPackTarget[];
}> {
  const questions = await listQuestions(sb, techId, opts);
  try {
    const packs = await listConsultationPacks(sb, techId, opts);
    const targets = await listPackTargetsForTech(sb, techId);
    return { questions, packs, targets };
  } catch {
    return { questions, packs: [], targets: [] };
  }
}
