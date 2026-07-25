import type {
  ConsultationPack,
  ConsultationPackTarget,
  ConsultationQuestion,
  Service,
} from "@/lib/db/types";

export const ALL_SERVICES_PACK_NAME = "All services";

/** True when a legacy (pre-pack) question applies to the given service. */
export function legacyQuestionAppliesToService(
  question: Pick<ConsultationQuestion, "serviceId" | "categoryId" | "packId">,
  service: Pick<Service, "id" | "categoryId">,
): boolean {
  if (question.packId) return false;
  const serviceId = question.serviceId ?? null;
  const categoryId = question.categoryId ?? null;
  if (!serviceId && !categoryId) return true;
  if (serviceId && serviceId === service.id) return true;
  if (!serviceId && categoryId && categoryId === service.categoryId) return true;
  return false;
}

/** @deprecated use legacyQuestionAppliesToService or questionAppliesWithPacks */
export function questionAppliesToService(
  question: Pick<ConsultationQuestion, "serviceId" | "categoryId">,
  service: Pick<Service, "id" | "categoryId">,
): boolean {
  return legacyQuestionAppliesToService(question, service);
}

/** Pack with no targets applies to every service. */
export function packAppliesToService(
  targets: Array<Pick<ConsultationPackTarget, "categoryId" | "serviceId">>,
  service: Pick<Service, "id" | "categoryId">,
): boolean {
  if (targets.length === 0) return true;
  for (const t of targets) {
    if (t.serviceId && t.serviceId === service.id) return true;
    if (t.categoryId && !t.serviceId && t.categoryId === service.categoryId) return true;
  }
  return false;
}

export type PackScopeIndex = {
  packsById: Map<string, ConsultationPack>;
  targetsByPackId: Map<string, ConsultationPackTarget[]>;
};

export function buildPackScopeIndex(
  packs: ConsultationPack[],
  targets: ConsultationPackTarget[],
): PackScopeIndex {
  const packsById = new Map(packs.map((p) => [p.id, p]));
  const targetsByPackId = new Map<string, ConsultationPackTarget[]>();
  for (const t of targets) {
    const list = targetsByPackId.get(t.packId) ?? [];
    list.push(t);
    targetsByPackId.set(t.packId, list);
  }
  return { packsById, targetsByPackId };
}

export function questionAppliesWithPacks(
  question: ConsultationQuestion,
  service: Pick<Service, "id" | "categoryId">,
  index: PackScopeIndex,
): boolean {
  const packId = question.packId ?? null;
  if (packId) {
    const pack = index.packsById.get(packId);
    if (!pack || pack.active === false) return false;
    return packAppliesToService(index.targetsByPackId.get(packId) ?? [], service);
  }
  return legacyQuestionAppliesToService(question, service);
}

/**
 * Questions shown for a booking: pack-scoped + legacy-scoped matches for any
 * booked service. Deduped by id, preserving list order.
 */
export function filterQuestionsForServices(
  questions: ConsultationQuestion[],
  services: Array<Pick<Service, "id" | "categoryId">>,
  index: PackScopeIndex = { packsById: new Map(), targetsByPackId: new Map() },
): ConsultationQuestion[] {
  if (services.length === 0) {
    return questions.filter((q) => {
      if (q.packId) {
        const targets = index.targetsByPackId.get(q.packId) ?? [];
        return targets.length === 0;
      }
      return !(q.serviceId ?? null) && !(q.categoryId ?? null);
    });
  }
  const seen = new Set<string>();
  const out: ConsultationQuestion[] = [];
  for (const q of questions) {
    if (seen.has(q.id)) continue;
    if (services.some((s) => questionAppliesWithPacks(q, s, index))) {
      seen.add(q.id);
      out.push(q);
    }
  }
  return out;
}

/** Human-readable scope for a pack (dashboard chips / labels). */
export function packScopeLabel(
  targets: Array<Pick<ConsultationPackTarget, "categoryId" | "serviceId">>,
  opts: {
    categoryName?: (id: string) => string | null | undefined;
    serviceName?: (id: string) => string | null | undefined;
  } = {},
): string {
  if (targets.length === 0) return "All services";
  const parts: string[] = [];
  for (const t of targets) {
    if (t.serviceId) {
      parts.push(opts.serviceName?.(t.serviceId) || "Service");
    } else if (t.categoryId) {
      parts.push(opts.categoryName?.(t.categoryId) || "Category");
    }
  }
  if (parts.length <= 2) return parts.join(" · ");
  return `${parts.slice(0, 2).join(" · ")} +${parts.length - 2} more`;
}

/** Legacy single-question label (pre-pack rows / tests). */
export function questionScopeLabel(
  question: Pick<ConsultationQuestion, "serviceId" | "categoryId" | "packId">,
  opts: {
    serviceName?: string | null;
    categoryName?: string | null;
    packName?: string | null;
    packTargetsLabel?: string | null;
  } = {},
): string {
  if (question.packId) {
    if (opts.packTargetsLabel) return opts.packTargetsLabel;
    if (opts.packName) return opts.packName;
    return "Form pack";
  }
  if (question.serviceId) {
    return opts.serviceName ? `Service: ${opts.serviceName}` : "Specific service";
  }
  if (question.categoryId) {
    return opts.categoryName ? `Category: ${opts.categoryName}` : "Specific category";
  }
  return "All services";
}

/** Parse a single Forms UI scope token into nullable ids. */
export function parseQuestionScope(raw: string): {
  categoryId: string | null;
  serviceId: string | null;
} {
  const value = raw.trim();
  if (value.startsWith("service:")) {
    const serviceId = value.slice("service:".length).trim();
    return { categoryId: null, serviceId: serviceId || null };
  }
  if (value.startsWith("category:")) {
    const categoryId = value.slice("category:".length).trim();
    return { categoryId: categoryId || null, serviceId: null };
  }
  return { categoryId: null, serviceId: null };
}

/** Parse repeated `target` form fields into pack targets (empty = all services). */
export function parsePackTargetsFromForm(
  values: string[],
): Array<{ categoryId: string | null; serviceId: string | null }> {
  const out: Array<{ categoryId: string | null; serviceId: string | null }> = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const v = String(raw ?? "").trim();
    if (!v || v === "all") continue;
    if (seen.has(v)) continue;
    const parsed = parseQuestionScope(v);
    if (!parsed.categoryId && !parsed.serviceId) continue;
    seen.add(v);
    out.push(parsed);
  }
  return out;
}

export type QuestionScopeOption = {
  value: string;
  label: string;
  kind: "all" | "category" | "service";
  categoryId?: string;
};

/** Flat option list for scope pickers (All → services → categories). */
export function buildQuestionScopeOptions(
  categories: Array<{ id: string; name: string }>,
  services: Array<{ id: string; name: string; active?: boolean; categoryId?: string }>,
): QuestionScopeOption[] {
  const active = services.filter((s) => s.active !== false);
  return [
    { value: "all", label: "All services", kind: "all" },
    ...active.map((s) => ({
      value: `service:${s.id}`,
      label: s.name,
      kind: "service" as const,
      categoryId: s.categoryId,
    })),
    ...categories.map((c) => ({
      value: `category:${c.id}`,
      label: c.name,
      kind: "category" as const,
      categoryId: c.id,
    })),
  ];
}

/**
 * Filter scope options by typed query. "All services" always stays visible.
 * Case-insensitive: every whitespace-separated token must appear in the label.
 */
export function filterQuestionScopeOptions(
  options: QuestionScopeOption[],
  query: string,
): QuestionScopeOption[] {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return options;
  return options.filter((o) => {
    if (o.kind === "all") return true;
    const label = o.label.toLowerCase();
    return tokens.every((t) => label.includes(t));
  });
}

export function questionScopeSelectionLabel(
  value: string,
  options: QuestionScopeOption[],
): string {
  return options.find((o) => o.value === value)?.label ?? "All services";
}

/** Group questions under packs for the Forms dashboard. */
export function groupQuestionsByPack(
  packs: ConsultationPack[],
  questions: ConsultationQuestion[],
): Array<{ pack: ConsultationPack; questions: ConsultationQuestion[] }> {
  const byPack = new Map<string, ConsultationQuestion[]>();
  for (const q of questions) {
    if (!q.packId) continue;
    const list = byPack.get(q.packId) ?? [];
    list.push(q);
    byPack.set(q.packId, list);
  }
  return [...packs]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
    .map((pack) => ({
      pack,
      questions: byPack.get(pack.id) ?? [],
    }));
}
