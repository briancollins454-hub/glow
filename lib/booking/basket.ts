import type { Service } from "@/lib/db/types";

/** Most treatments a client can chain into one visit. */
export const BASKET_MAX_EXTRAS = 5;

/**
 * Resolve the extra treatments a client added to their basket. Ids come from
 * the `also` form/URL param; anything inactive, duplicated, unknown or not
 * bookable in a basket (patch-test services) is dropped.
 */
export function resolveBasketExtras(
  allServices: Service[],
  primaryId: string,
  alsoParam: string | null | undefined,
): Service[] {
  if (!alsoParam) return [];
  const seen = new Set<string>([primaryId]);
  const extras: Service[] = [];
  for (const id of alsoParam.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (seen.has(id)) continue;
    seen.add(id);
    const svc = allServices.find((s) => s.id === id && s.active && !s.isPatchTestService);
    if (svc) extras.push(svc);
  }
  return extras.slice(0, BASKET_MAX_EXTRAS);
}

/** Services offered in the "add another treatment" list. */
export function addableBasketServices(
  allServices: Service[],
  primaryId: string,
  extras: Service[],
): Service[] {
  const taken = new Set<string>([primaryId, ...extras.map((s) => s.id)]);
  return allServices.filter((s) => s.active && !s.isPatchTestService && !taken.has(s.id));
}

/** Serialise a basket back into the `also` URL param. */
export function basketParam(extras: Service[]): string {
  return extras.map((s) => s.id).join(",");
}
