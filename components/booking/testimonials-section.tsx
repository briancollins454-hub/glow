import { Star, MessageSquareQuote } from "lucide-react";
import type { Testimonial } from "@/lib/db/types";

/** Clearly labelled, separate from Glow reviews. Plain text only (no HTML). */
export function TestimonialsSection({ testimonials }: { testimonials: Testimonial[] }) {
  if (testimonials.length === 0) return null;

  return (
    <section id="from-before-glow" className="scroll-mt-24 animate-fade-in">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageSquareQuote className="h-5 w-5 text-ink-faint" />
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
            From before Glow
          </h2>
        </div>
      </div>
      <p className="mb-4 text-xs text-ink-faint">
        Imported testimonials, not verified Glow bookings.
      </p>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-3">
        {testimonials.map((t) => (
          <article
            key={t.id}
            className="min-w-[min(100%,280px)] shrink-0 rounded-2xl border border-dashed border-edge bg-surface/50 p-4 sm:min-w-0"
          >
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] font-display text-sm font-semibold text-ink-soft"
                aria-hidden
              >
                {t.authorLabel.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{t.authorLabel}</p>
                {t.rating != null && (
                  <span className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`h-3 w-3 ${
                          n <= t.rating!
                            ? "fill-amber-400/80 text-amber-400/80"
                            : "text-ink-faint"
                        }`}
                      />
                    ))}
                  </span>
                )}
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              &ldquo;{t.body}&rdquo;
            </p>
            <p className="mt-3 text-[11px] uppercase tracking-wide text-ink-faint">
              via {t.sourceLabel}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
