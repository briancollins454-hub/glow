import Link from "next/link";
import { Clock, RefreshCw, ShieldCheck } from "lucide-react";
import type { Service } from "@/lib/db/types";
import { ServicePhoto } from "@/components/booking/service-photo";
import { gbp, minutesToLabel } from "@/lib/format";
import { depositFor } from "@/lib/rules";
import { withAlpha } from "@/lib/booking/brand";

export function ServiceCard({
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
    <Link
      href={`/${handle}?service=${service.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-edge bg-surface/90 shadow-card transition duration-300 hover:-translate-y-0.5 hover:border-white/15 hover:shadow-soft"
    >
      {photoUrl ? (
        <ServicePhoto src={photoUrl} alt={service.name} />
      ) : (
        <div
          className="relative aspect-[2/1] w-full shrink-0"
          style={{
            background: `linear-gradient(135deg, ${withAlpha(brand, 0.35)} 0%, ${withAlpha(brand, 0.08)} 100%)`,
          }}
        />
      )}

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-semibold leading-snug text-ink sm:text-xl">
            {service.name}
          </h3>
          <p className="shrink-0 font-display text-lg font-semibold text-ink sm:text-xl">
            {gbp(service.pricePennies)}
          </p>
        </div>

        {service.description && (
          <p className="mt-2 text-sm leading-relaxed text-ink-soft line-clamp-3">
            {service.description}
          </p>
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

        <span
          className="mt-4 block w-full rounded-xl py-3 text-center text-sm font-semibold text-white transition group-hover:brightness-110"
          style={{ backgroundColor: brand }}
        >
          Book this service
        </span>
      </div>
    </Link>
  );
}
