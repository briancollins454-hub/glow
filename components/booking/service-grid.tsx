"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, RefreshCw, ShieldCheck } from "lucide-react";
import type { Service, ServiceCategory } from "@/lib/db/types";
import {
  categorySectionId,
  defaultOpenCategoryId,
  groupServicesForMenu,
  serviceSectionId,
} from "@/lib/booking/service-groups";
import { CategorySection } from "@/components/booking/category-section";
import { ExpandableText } from "@/components/booking/expandable-text";
import { gbp, minutesToLabel } from "@/lib/format";
import { depositFor } from "@/lib/rules";
import { onBrand, withAlpha } from "@/lib/booking/brand";

function ServiceCard({
  service,
  handle,
  brand,
  photoUrl,
}: {
  service: Service;
  handle: string;
  brand: string;
  photoUrl?: string;
}) {
  const deposit = depositFor(service);

  return (
    <article
      id={serviceSectionId(service.id)}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-edge bg-surface/90 shadow-card transition hover:border-edge hover:shadow-glow"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-cream">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={service.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(135deg, ${withAlpha(brand, 0.4)} 0%, ${withAlpha(brand, 0.08)} 100%)`,
            }}
          />
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-display text-lg font-semibold leading-snug text-ink">{service.name}</h4>
          <p className="shrink-0 font-display text-lg font-semibold text-ink">
            {gbp(service.pricePennies)}
          </p>
        </div>

        {service.description && (
          <ExpandableText text={service.description} className="mt-2" clampClass="line-clamp-2" />
        )}

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-faint">
          <span className="inline-flex items-center gap-1 rounded-full border border-edge bg-fill px-2.5 py-1">
            <Clock className="h-3 w-3" />
            {minutesToLabel(service.durationMin)}
          </span>
          {deposit > 0 && (
            <span className="rounded-full border border-edge bg-fill px-2.5 py-1">
              {gbp(deposit)} deposit
            </span>
          )}
          {service.requiresPatchTest && (
            <span className="inline-flex items-center gap-1 rounded-full border border-edge bg-warning-soft px-2.5 py-1 text-warning-text">
              <ShieldCheck className="h-3 w-3" />
              Patch test
            </span>
          )}
          {service.isInfill && (
            <span className="inline-flex items-center gap-1 rounded-full border border-edge bg-pending-soft px-2.5 py-1 text-pending-text">
              <RefreshCw className="h-3 w-3" />
              Returning clients
            </span>
          )}
        </div>

        <Link
          href={`/${handle}?service=${service.id}`}
          className="mt-5 block w-full rounded-xl py-3 text-center text-sm font-semibold transition hover:brightness-110"
          style={{ backgroundColor: brand, color: onBrand(brand) }}
        >
          Book this service
        </Link>
      </div>
    </article>
  );
}

export function ServiceGrid({
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
  const groups = groupServicesForMenu(categories, services);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(() =>
    defaultOpenCategoryId(groups),
  );

  useEffect(() => {
    const prefix = "services-cat-";
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (id?.startsWith(prefix)) {
        setOpenCategoryId(id.slice(prefix.length));
      }
    };
    window.addEventListener("booking-navigate", handler);
    return () => window.removeEventListener("booking-navigate", handler);
  }, []);

  const toggleCategory = (id: string) => {
    setOpenCategoryId((current) => (current === id ? null : id));
  };

  if (services.length === 0) {
    return (
      <section id="services" className="scroll-mt-24 rounded-2xl border border-edge bg-surface/80 p-10 text-center text-ink-soft">
        This studio hasn&apos;t published any services yet.
      </section>
    );
  }

  return (
    <section id="services" className="scroll-mt-24 space-y-6 animate-fade-in">
      <div className="text-center sm:text-left">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Treatments
        </h2>
        <p className="mt-2 text-base text-ink-soft">Choose a category, then pick a service and time.</p>
      </div>

      <div className="space-y-3">
        {groups.map((group) => (
          <CategorySection
            key={group.id}
            id={categorySectionId(group.id)}
            title={group.title}
            count={group.services.length}
            open={openCategoryId === group.id}
            onToggle={() => toggleCategory(group.id)}
          >
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {group.services.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  handle={handle}
                  brand={brand}
                  photoUrl={photoUrls.get(service.id)}
                />
              ))}
            </div>
          </CategorySection>
        ))}
      </div>
    </section>
  );
}
