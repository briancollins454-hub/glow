import type { ConsultationQuestion, Service } from "@/lib/db/types";

/** True when a question applies to the given service (and its category). */
export function questionAppliesToService(
  question: Pick<ConsultationQuestion, "serviceId" | "categoryId">,
  service: Pick<Service, "id" | "categoryId">,
): boolean {
  const serviceId = question.serviceId ?? null;
  const categoryId = question.categoryId ?? null;
  if (!serviceId && !categoryId) return true; // global
  if (serviceId && serviceId === service.id) return true;
  if (!serviceId && categoryId && categoryId === service.categoryId) return true;
  return false;
}

/**
 * Questions shown for a booking: globals plus those scoped to any booked
 * service or its category. Deduped by id, preserving list order.
 */
export function filterQuestionsForServices(
  questions: ConsultationQuestion[],
  services: Array<Pick<Service, "id" | "categoryId">>,
): ConsultationQuestion[] {
  if (services.length === 0) {
    return questions.filter((q) => !(q.serviceId ?? null) && !(q.categoryId ?? null));
  }
  const seen = new Set<string>();
  const out: ConsultationQuestion[] = [];
  for (const q of questions) {
    if (seen.has(q.id)) continue;
    if (services.some((s) => questionAppliesToService(q, s))) {
      seen.add(q.id);
      out.push(q);
    }
  }
  return out;
}

/** Human-readable scope label for the Forms settings list. */
export function questionScopeLabel(
  question: Pick<ConsultationQuestion, "serviceId" | "categoryId">,
  opts: {
    serviceName?: string | null;
    categoryName?: string | null;
  } = {},
): string {
  if (question.serviceId) {
    return opts.serviceName ? `Service: ${opts.serviceName}` : "Specific service";
  }
  if (question.categoryId) {
    return opts.categoryName ? `Category: ${opts.categoryName}` : "Specific category";
  }
  return "All services";
}

/** Parse Forms UI scope value into nullable ids. */
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
