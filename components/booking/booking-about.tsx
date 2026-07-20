import { Instagram, MapPin, Star } from "lucide-react";

export function BookingAbout({
  bio,
  location,
  instagram,
  tiktok,
  ratingAvg,
  ratingCount,
}: {
  bio?: string;
  location?: string;
  instagram?: string;
  tiktok?: string;
  ratingAvg: number;
  ratingCount: number;
}) {
  const hasMeta = location || instagram || tiktok || ratingCount > 0;
  if (!bio?.trim() && !hasMeta) return null;

  return (
    <section className="animate-fade-in">
      <div className="-mt-10 rounded-2xl border border-edge bg-surface/90 p-6 shadow-card sm:p-8">
        {bio?.trim() && (
          <>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              About
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-ink-soft whitespace-pre-line">
              {bio}
            </p>
          </>
        )}

        {hasMeta && (
          <div className={`flex flex-wrap gap-2 ${bio?.trim() ? "mt-6" : ""}`}>
            {ratingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-fill px-3 py-1.5 text-sm text-ink-soft">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {ratingAvg.toFixed(1)} · {ratingCount} review{ratingCount > 1 ? "s" : ""}
              </span>
            )}
            {location && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-fill px-3 py-1.5 text-sm text-ink-soft">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {location}
              </span>
            )}
            {instagram && (
              <a
                href={`https://instagram.com/${instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-fill px-3 py-1.5 text-sm text-ink-soft transition hover:border-edge hover:text-ink"
              >
                <Instagram className="h-3.5 w-3.5" />
                @{instagram}
              </a>
            )}
            {tiktok && (
              <a
                href={`https://tiktok.com/@${tiktok}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-fill px-3 py-1.5 text-sm text-ink-soft transition hover:border-edge hover:text-ink"
              >
                @{tiktok} on TikTok
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
