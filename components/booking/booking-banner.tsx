"use client";

import { useState } from "react";
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

  // The banner is never cropped: the sharp image is letterboxed (object-contain)
  // over a blurred copy of itself that fills the gaps. Once loaded we also know
  // the image's shape, so the hero height tracks it (within limits) to keep the
  // letterboxing minimal. Pages without a banner keep the fixed-height gradient.
  const [ratio, setRatio] = useState<number | null>(null);
  const measure = (img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth && img.naturalHeight) {
      setRatio(img.naturalWidth / img.naturalHeight);
    }
  };
  const adaptive = Boolean(coverUrl && ratio);
  const heightStyle = adaptive
    ? { minHeight: `clamp(400px, calc(100vw / ${ratio}), min(82vh, 680px))` }
    : undefined;
  const heightClass = adaptive ? "" : "min-h-[min(72vh,520px)]";

  const scrollToServices = () => {
    document.getElementById("services")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section
      data-booking-hero
      className={`relative isolate flex w-full items-center justify-center overflow-hidden ${heightClass}`}
      style={heightStyle}
    >
      <div className="absolute inset-0">
        {coverUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt=""
              aria-hidden
              decoding="async"
              draggable={false}
              className="absolute inset-0 block h-full w-full max-w-none scale-110 object-cover object-center blur-2xl"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt=""
              ref={measure}
              onLoad={(e) => measure(e.currentTarget)}
              decoding="async"
              draggable={false}
              className="absolute inset-0 block h-full w-full max-w-none object-contain object-center"
            />
            {/* Darken only the middle band where the headline sits, so the top
                and bottom of the artwork stay visible instead of fading to black. */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, ${withAlpha("#0b0910", 0.2)} 0%, ${withAlpha("#0b0910", 0.6)} 38%, ${withAlpha("#0b0910", 0.6)} 62%, ${withAlpha("#0b0910", 0.25)} 100%)`,
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
        {/* Brand tint only over the gradient fallback — banner artwork stays true to its colours. */}
        {!coverUrl && (
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              background: `linear-gradient(135deg, ${withAlpha(heroBase, 0.35)} 0%, transparent 50%)`,
            }}
          />
        )}
      </div>

      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80"
          style={{ textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}
        >
          Book online
        </p>
        <h1
          className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl"
          style={{ textShadow: "0 2px 24px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.5)" }}
        >
          {headline}
        </h1>
        {tagline?.trim() && tagline.trim() !== businessName && (
          <p
            className="mt-3 text-lg text-white/90 sm:text-xl"
            style={{ textShadow: "0 1px 12px rgba(0,0,0,0.6)" }}
          >
            {businessName}
          </p>
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
