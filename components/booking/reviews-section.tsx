import { Star } from "lucide-react";
import type { Review } from "@/lib/db/types";

export function ReviewsSection({
  reviews,
  ratingAvg,
  ratingCount,
}: {
  reviews: { review: Review; clientLabel: string }[];
  ratingAvg: number;
  ratingCount: number;
}) {
  return (
    <section id="reviews" className="scroll-mt-24 animate-fade-in">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
            What clients say
          </h2>
        </div>
        {reviews.length > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-ink-soft">
            <span className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`h-3.5 w-3.5 ${
                    n <= Math.round(ratingAvg)
                      ? "fill-amber-400 text-amber-400"
                      : "text-ink-faint"
                  }`}
                />
              ))}
            </span>
            <span className="font-medium text-ink">{ratingAvg.toFixed(1)}</span>
            <span className="text-ink-faint">({ratingCount})</span>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="rounded-2xl border border-edge bg-surface/80 px-5 py-8 text-center text-sm text-ink-soft">
          Client reviews will show here once people leave feedback after their appointments.
        </p>
      ) : (
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-3">
        {reviews.map(({ review, clientLabel }) => (
          <article
            key={review.id}
            className="min-w-[min(100%,280px)] shrink-0 rounded-2xl border border-edge bg-surface/80 p-4 shadow-card sm:min-w-0"
          >
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/15 font-display text-sm font-semibold text-brand-300"
                aria-hidden
              >
                {clientLabel.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-ink">{clientLabel}</p>
                <span className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-3 w-3 ${
                        n <= review.rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-ink-faint"
                      }`}
                    />
                  ))}
                </span>
              </div>
            </div>
            {review.comment && (
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                &ldquo;{review.comment}&rdquo;
              </p>
            )}
          </article>
        ))}
      </div>
      )}
    </section>
  );
}
