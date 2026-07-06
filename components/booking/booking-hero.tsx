import { Instagram, MapPin, Star } from "lucide-react";
import { HeroPhoto, AvatarPhoto } from "@/components/booking/service-photo";
import { initials, shade, withAlpha } from "@/lib/booking/brand";

export function BookingHero({
  businessName,
  bio,
  brand,
  coverUrl,
  avatarUrl,
  location,
  instagram,
  ratingAvg,
  ratingCount,
}: {
  businessName: string;
  bio?: string;
  brand: string;
  coverUrl?: string;
  avatarUrl?: string;
  location?: string;
  instagram?: string;
  ratingAvg: number;
  ratingCount: number;
}) {
  const darker = shade(brand, -32);
  const glow = withAlpha(brand, 0.35);

  return (
    <header className="relative isolate overflow-hidden">
      {/* Cover image or brand gradient */}
      <div className="absolute inset-0">
        {coverUrl ? (
          <>
            <HeroPhoto src={coverUrl} alt="" />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, ${withAlpha("#0b0910", 0.25)} 0%, ${withAlpha("#0b0910", 0.55)} 45%, #0b0910 100%)`,
              }}
            />
            <div
              className="absolute inset-0 opacity-60"
              style={{
                background: `linear-gradient(135deg, ${withAlpha(brand, 0.45)} 0%, transparent 55%, ${withAlpha(darker, 0.5)} 100%)`,
              }}
            />
          </>
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(145deg, ${brand} 0%, ${darker} 55%, #0b0910 100%)`,
            }}
          />
        )}
        {/* Soft brand glow at bottom of hero */}
        <div
          className="pointer-events-none absolute -bottom-24 left-1/2 h-48 w-[120%] -translate-x-1/2 blur-3xl"
          style={{ background: `radial-gradient(ellipse, ${glow}, transparent 70%)` }}
        />
      </div>

      <div className="relative mx-auto max-w-2xl px-4 pb-10 pt-16 sm:pb-14 sm:pt-20">
        {/* Avatar */}
        <div className="flex justify-center">
          <div
            className="relative rounded-[1.35rem] p-[3px] shadow-glow"
            style={{
              background: `linear-gradient(135deg, ${brand}, ${shade(brand, 20)})`,
            }}
          >
            <div className="relative h-24 w-24 overflow-hidden rounded-[1.2rem] bg-cream sm:h-28 sm:w-28">
              {avatarUrl ? (
                <AvatarPhoto src={avatarUrl} alt={businessName} />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center font-display text-2xl font-semibold text-white sm:text-3xl"
                  style={{ background: `linear-gradient(135deg, ${brand}, ${darker})` }}
                >
                  {initials(businessName)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 text-center">
          <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight text-white sm:text-4xl">
            {businessName}
          </h1>
          {bio && (
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-white/80 sm:text-base">
              {bio}
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {ratingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
              <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
              {ratingAvg.toFixed(1)}
              <span className="text-white/70">
                · {ratingCount} review{ratingCount > 1 ? "s" : ""}
              </span>
            </span>
          )}
          {location && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-white/90 backdrop-blur-sm">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {location}
            </span>
          )}
          {instagram && (
            <a
              href={`https://instagram.com/${instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-white/90 backdrop-blur-sm transition hover:border-white/30 hover:bg-white/15 hover:text-white"
            >
              <Instagram className="h-3.5 w-3.5 shrink-0" />
              @{instagram}
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
