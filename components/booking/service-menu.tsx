"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Clock, RefreshCw, ShieldCheck } from "lucide-react";
import type { Service, ServiceCategory } from "@/lib/db/types";
import { ServicePhoto } from "@/components/booking/service-photo";
import { gbp, minutesToLabel } from "@/lib/format";
import { depositFor } from "@/lib/rules";
import { withAlpha } from "@/lib/booking/brand";
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
            className="mt-4 block w-full rounded-xl py-3 text-center text-sm font-semibold text-white transition hover:brightness-110"
            style={{ backgroundColor: brand }}
          >
            Book this service
          </Link>
        </div>
      </div>
    </article>
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
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id));

  if (services.length === 0) {
    return (
      <div className="rounded-2xl border border-edge bg-surface/80 p-10 text-center text-ink-soft">
        This studio hasn&apos;t published any services yet.
      </div>
    );
  }

  const grouped = categories.filter((c) => services.some((s) => s.categoryId === c.id));
  const uncategorised = services.filter((s) => !grouped.some((c) => c.id === s.categoryId));

  const renderServices = (list: Service[]) => (
    <div className="grid gap-3">
      {list.map((s) => (
        <ServiceAccordionItem
          key={s.id}
          service={s}
          handle={handle}
          brand={brand}
          photoUrl={photoUrls.get(s.id)}
          open={openId === s.id}
          onToggle={toggle}
        />
      ))}
    </div>
  );

  return (
    <div id="services" className="scroll-mt-6 space-y-8 animate-fade-in">
      {grouped.map((cat) => (
        <section key={cat.id}>
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">{cat.name}</h2>
            <span className="text-xs font-medium uppercase tracking-wider text-ink-faint">
              {services.filter((s) => s.categoryId === cat.id).length} service
              {services.filter((s) => s.categoryId === cat.id).length !== 1 ? "s" : ""}
            </span>
          </div>
          {renderServices(services.filter((s) => s.categoryId === cat.id))}
        </section>
      ))}

      {uncategorised.length > 0 && (
        <section>
          {grouped.length > 0 && (
            <h2 className="mb-3 font-display text-2xl font-semibold tracking-tight text-ink">More services</h2>
          )}
          {renderServices(uncategorised)}
        </section>
      )}
    </div>
  );
}
