"use client";

import { RemoteImage } from "@/components/ui/remote-image";
import { heroBrand, onBrand, shade, withAlpha } from "@/lib/booking/brand";

export function BookingBanner({
  businessName,
  tagline,
  brand,
  coverUrl,
  hasServices,
}: {
  businessName: string;
  tagline?: string;
  brand: string;
  coverUrl?: string;
  hasServices: boolean;
}) {
  const headline = tagline?.trim() || businessName;
  // Gradients sit under fixed white text, so light brands are darkened first.
  const heroBase = heroBrand(brand);
  const darker = shade(heroBase, -32);

  const scrollToServices = () => {
    document.getElementById("services")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section data-booking-hero className="relative isolate min-h-[min(72vh,520px)] w-full overflow-hidden">
      <div className="absolute inset-0">
        {coverUrl ? (
          <>
            <RemoteImage src={coverUrl} alt="" fill fit="cover" position="center" />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, ${withAlpha("#0b0910", 0.35)} 0%, ${withAlpha("#0b0910", 0.72)} 70%, #0b0910 100%)`,
              }}
            />
          </>
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(145deg, ${heroBase} 0%, ${darker} 50%, #0b0910 100%)`,
            }}
          />
        )}
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background: `linear-gradient(135deg, ${withAlpha(heroBase, 0.35)} 0%, transparent 50%)`,
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-[min(72vh,520px)] max-w-5xl flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          Book online
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
          {headline}
        </h1>
        {tagline?.trim() && tagline.trim() !== businessName && (
          <p className="mt-3 text-lg text-white/80 sm:text-xl">{businessName}</p>
        )}
        {hasServices && (
          <button
            type="button"
            onClick={scrollToServices}
            className="mt-8 rounded-xl px-8 py-3.5 text-sm font-semibold shadow-lg transition hover:brightness-110"
            style={{ backgroundColor: brand, color: onBrand(brand) }}
          >
            Book appointment
          </button>
        )}
      </div>
    </section>
  );
}
