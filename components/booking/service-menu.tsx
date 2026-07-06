import type { Service, ServiceCategory } from "@/lib/db/types";
import { ServiceCard } from "@/components/booking/service-card";

export function ServiceMenu({
  categories,
  services,
  handle,
  brand,
  photoUrls,
}: {
  categories: ServiceCategory[];
  services: Service[];
  handle: string;
  brand: string;
  photoUrls: Map<string, string>;
}) {
  if (services.length === 0) {
    return (
      <div className="rounded-2xl border border-edge bg-surface/80 p-10 text-center text-ink-soft">
        This studio hasn&apos;t published any services yet.
      </div>
    );
  }

  const grouped = categories.filter((c) => services.some((s) => s.categoryId === c.id));
  const uncategorised = services.filter((s) => !grouped.some((c) => c.id === s.categoryId));

  return (
    <div id="services" className="scroll-mt-6 space-y-10 animate-fade-in">
      {grouped.map((cat) => (
        <section key={cat.id}>
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
              {cat.name}
            </h2>
            <span className="text-xs font-medium uppercase tracking-wider text-ink-faint">
              {services.filter((s) => s.categoryId === cat.id).length} service
              {services.filter((s) => s.categoryId === cat.id).length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="grid gap-4">
            {services
              .filter((s) => s.categoryId === cat.id)
              .map((s) => (
                <ServiceCard
                  key={s.id}
                  service={s}
                  handle={handle}
                  brand={brand}
                  photoUrl={photoUrls.get(s.id)}
                />
              ))}
          </div>
        </section>
      ))}

      {uncategorised.length > 0 && (
        <section>
          {grouped.length > 0 && (
            <h2 className="mb-4 font-display text-2xl font-semibold tracking-tight text-ink">
              More services
            </h2>
          )}
          <div className="grid gap-4">
            {uncategorised.map((s) => (
              <ServiceCard
                key={s.id}
                service={s}
                handle={handle}
                brand={brand}
                photoUrl={photoUrls.get(s.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
