"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { RemoteImage } from "@/components/ui/remote-image";

type PortfolioItem = { id: string; url: string; kind: string };

export function PortfolioGallery({ items }: { items: PortfolioItem[] }) {
  const [lightbox, setLightbox] = useState<PortfolioItem | null>(null);

  return (
    <>
      <section id="gallery" className="scroll-mt-24 animate-fade-in">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand-400" />
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
            Gallery
          </h2>
        </div>

        {items.length === 0 ? (
          <p className="rounded-2xl border border-edge bg-surface/80 px-5 py-8 text-center text-sm text-ink-soft">
            Before and after photos will appear here once they&apos;re added.
          </p>
        ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {items.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setLightbox(p)}
              className={`group relative overflow-hidden rounded-xl border border-edge bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                i === 0 && items.length >= 3 ? "col-span-2 row-span-2 aspect-[4/5] sm:aspect-[3/4]" : "aspect-square"
              }`}
            >
              <RemoteImage
                src={p.url}
                alt={`${p.kind} work`}
                fill
                position="center 35%"
                className="transition duration-500 group-hover:scale-105"
                sizes={i === 0 ? "(max-width: 640px) 100vw, 50vw" : "(max-width: 640px) 50vw, 25vw"}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
              <span className="absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-medium capitalize text-white backdrop-blur-sm">
                {p.kind}
              </span>
            </button>
          ))}
        </div>
        )}
      </section>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Portfolio image"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 rounded-full border border-edge bg-white/10 p-2 text-white transition hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="relative max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <RemoteImage
              src={lightbox.url}
              alt={`${lightbox.kind} work`}
              width={800}
              height={800}
              className="h-auto w-full object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
