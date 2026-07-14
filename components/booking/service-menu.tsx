"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Clock, RefreshCw, ShieldCheck } from "lucide-react";
import type { Service, ServiceCategory } from "@/lib/db/types";
import {
  defaultOpenCategoryId,
  groupServicesForMenu,
} from "@/lib/booking/service-groups";
import { ServicePhoto } from "@/components/booking/service-photo";
import { gbp, minutesToLabel } from "@/lib/format";
import { depositFor } from "@/lib/rules";
import { onBrand, withAlpha } from "@/lib/booking/brand";
import { cn } from "@/lib/utils";

function ServiceAccordionItem({
  service,
  handle,
  brand,
  photoUrl,
  open,
  onToggle,
}: {
  service: Service;
  handle: string;
  brand: string;
  photoUrl?: string;
  open: boolean;
  onToggle: (id: string) => void;
}) {
  const deposit = depositFor(service);

  return (
    <article className="overflow-hidden rounded-2xl border border-edge bg-surface/90 shadow-card transition hover:border-white/15">
      <button
        type="button"
        id={`service-${service.id}`}
        aria-expanded={open}
        aria-controls={`service-panel-${service.id}`}
        onClick={() => onToggle(service.id)}
        className="flex w-full items-center gap-3 p-4 text-left sm:gap-4 sm:p-5"
      >
        {photoUrl ? (
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl sm:h-16 sm:w-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          </div>
        ) : (
          <div
            className="h-14 w-14 shrink-0 rounded-xl sm:h-16 sm:w-16"
            style={{
              background: `linear-gradient(135deg, ${withAlpha(brand, 0.35)} 0%, ${withAlpha(brand, 0.08)} 100%)`,
            }}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-base font-semibold leading-snug text-ink sm:text-lg">
              {service.name}
            </h3>
            <p className="shrink-0 font-display text-base font-semibold text-ink sm:text-lg">
              {gbp(service.pricePennies)}
            </p>
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            {minutesToLabel(service.durationMin)}
            {deposit > 0 ? ` · ${gbp(deposit)} deposit` : ""}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-ink-faint transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      <div
        id={`service-panel-${service.id}`}
        role="region"
        aria-labelledby={`service-${service.id}`}
        hidden={!open}
        className={cn(!open && "hidden")}
      >
        <div className="border-t border-edge px-4 pb-4 sm:px-5 sm:pb-5">
          {photoUrl && (
            <div className="mt-4 overflow-hidden rounded-xl">
              <ServicePhoto src={photoUrl} alt={service.name} />
            </div>
          )}

          {service.description && (
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">{service.description}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
            <span className="inline-flex items-center gap-1 rounded-full border border-edge bg-white/[0.03] px-2.5 py-1">
              <Clock className="h-3 w-3" />
              {minutesToLabel(service.durationMin)}
            </span>
            {deposit > 0 && (
              <span className="rounded-full border border-edge bg-white/[0.03] px-2.5 py-1">
                {gbp(deposit)} deposit
              </span>
            )}
            {service.requiresPatchTest && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-amber-200/90">
                <ShieldCheck className="h-3 w-3" />
                Patch test
              </span>
            )}
            {service.isInfill && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-violet-200/90">
                <RefreshCw className="h-3 w-3" />
                Returning clients
              </span>
            )}
          </div>

          <Link
            href={`/${handle}?service=${service.id}`}
            className="mt-4 block w-full rounded-xl py-3 text-center text-sm font-semibold transition hover:brightness-110"
            style={{ backgroundColor: brand, color: onBrand(brand) }}
          >
            Book this service
          </Link>
        </div>
      </div>
    </article>
  );
}

function CategorySection({
  id,
  title,
  count,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  count: number;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-edge bg-surface/80">
      <button
        type="button"
        id={`category-${id}`}
        aria-expanded={open}
        aria-controls={`category-panel-${id}`}
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-white/[0.03] sm:px-5"
      >
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            {title}
          </h2>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-ink-faint">
            {count} service{count !== 1 ? "s" : ""}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-ink-faint transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div
        id={`category-panel-${id}`}
        role="region"
        aria-labelledby={`category-${id}`}
        hidden={!open}
        className={cn(!open && "hidden")}
      >
        <div className="grid gap-3 border-t border-edge px-4 py-4 sm:px-5 sm:py-5">
          {children}
        </div>
      </div>
    </section>
  );
}

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
  const groups = groupServicesForMenu(categories, services);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(() =>
    defaultOpenCategoryId(groups),
  );
  const [openServiceId, setOpenServiceId] = useState<string | null>(null);

  const toggleCategory = (id: string) => {
    setOpenCategoryId((current) => (current === id ? null : id));
    setOpenServiceId(null);
  };

  const toggleService = (id: string) => setOpenServiceId((current) => (current === id ? null : id));

  if (services.length === 0) {
    return (
      <div className="rounded-2xl border border-edge bg-surface/80 p-10 text-center text-ink-soft">
        This studio hasn&apos;t published any services yet.
      </div>
    );
  }

  return (
    <div id="services" className="scroll-mt-6 space-y-3 animate-fade-in">
      {groups.map((group) => (
        <CategorySection
          key={group.id}
          id={group.id}
          title={group.title}
          count={group.services.length}
          open={openCategoryId === group.id}
          onToggle={toggleCategory}
        >
          {group.services.map((service) => (
            <ServiceAccordionItem
              key={service.id}
              service={service}
              handle={handle}
              brand={brand}
              photoUrl={photoUrls.get(service.id)}
              open={openServiceId === service.id}
              onToggle={toggleService}
            />
          ))}
        </CategorySection>
      ))}
    </div>
  );
}
