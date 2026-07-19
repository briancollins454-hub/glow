import type { Service, ServiceCategory } from "@/lib/db/types";

export const UNCATEGORISED_ID = "__uncategorised__";

export type ServiceGroup = {
  id: string;
  title: string;
  services: Service[];
};

/**
 * Groups active services for the public booking menu using each tech's existing
 * categories. No data migration — reads categoryId already on every service.
 */
export function groupServicesForMenu(
  categories: ServiceCategory[],
  services: Service[],
): ServiceGroup[] {
  const categoryIds = new Set(categories.map((c) => c.id));
  const byCategory = new Map<string, Service[]>();

  for (const service of services) {
    if (service.isPatchTestService) continue;
    const bucket = categoryIds.has(service.categoryId) ? service.categoryId : UNCATEGORISED_ID;
    const list = byCategory.get(bucket) ?? [];
    list.push(service);
    byCategory.set(bucket, list);
  }

  const groups: ServiceGroup[] = [];

  for (const cat of categories) {
    const catServices = byCategory.get(cat.id);
    if (catServices?.length) {
      groups.push({ id: cat.id, title: cat.name, services: catServices });
    }
  }

  const loose = byCategory.get(UNCATEGORISED_ID);
  if (loose?.length) {
    groups.push({
      id: UNCATEGORISED_ID,
      title: groups.length > 0 ? "More services" : "Services",
      services: loose,
    });
  }

  return groups;
}

/** DOM id for a category block on the public booking page. */
export function categorySectionId(groupId: string): string {
  return `services-cat-${groupId}`;
}

/** DOM id for an individual service card. */
export function serviceSectionId(serviceId: string): string {
  return `service-${serviceId}`;
}

/** Single-category pages open by default so existing simple setups feel unchanged. */
export function defaultOpenCategoryId(groups: ServiceGroup[]): string | null {
  return groups.length === 1 ? groups[0]!.id : null;
}

/**
 * Groups all dashboard services by category (includes inactive + patch-test rows).
 * Used for collapsible category sections on Services.
 */
export function groupServicesForDashboard(
  categories: ServiceCategory[],
  services: Service[],
): ServiceGroup[] {
  const categoryIds = new Set(categories.map((c) => c.id));
  const byCategory = new Map<string, Service[]>();

  for (const service of services) {
    const bucket = categoryIds.has(service.categoryId) ? service.categoryId : UNCATEGORISED_ID;
    const list = byCategory.get(bucket) ?? [];
    list.push(service);
    byCategory.set(bucket, list);
  }

  const groups: ServiceGroup[] = [];
  for (const cat of categories) {
    const catServices = byCategory.get(cat.id);
    if (catServices?.length) {
      groups.push({ id: cat.id, title: cat.name, services: catServices });
    }
  }
  const loose = byCategory.get(UNCATEGORISED_ID);
  if (loose?.length) {
    groups.push({
      id: UNCATEGORISED_ID,
      title: groups.length > 0 ? "Other" : "Services",
      services: loose,
    });
  }
  return groups;
}
