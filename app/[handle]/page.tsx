import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseService } from "@/lib/supabase/service";
import {
  listBlockingBookingsInRange,
  listCategories,
  listQuestions,
  listServices,
  listTimeOff,
  listWorkingHours,
  getTechByHandle,
  addonsForService,
  listApprovedReviews,
  listClientPhotosForTech,
  getClientNameMap,
} from "@/lib/db/queries";
import { signedPhotoUrls } from "@/lib/storage";
import { availableDays } from "@/lib/rules";
import { isLive } from "@/lib/subscriptions";
import { gbp } from "@/lib/format";
import type { ConsultationQuestion, Review, ServiceAddon, Tech } from "@/lib/db/types";
import { BookingStepInteractive } from "@/components/booking/booking-step-interactive";
import { BookingHero } from "@/components/booking/booking-hero";
import { ServiceMenu } from "@/components/booking/service-menu";
import { PortfolioGallery } from "@/components/booking/portfolio-gallery";
import { ReviewsSection } from "@/components/booking/reviews-section";
import { OpeningHours } from "@/components/booking/opening-hours";
import { StickyBookCta } from "@/components/booking/sticky-book-cta";
import { trackPageView } from "@/lib/page-views";

type DayOption = { dateStr: string; slots: string[] };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const tech = await getTechByHandle(supabaseService(), handle);
  if (!tech) return {};
  const title = `${tech.businessName} - book online`;
  const description =
    tech.bio ||
    `Book ${tech.businessName} online. Secure your slot with a deposit. Powered by Glow.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export const revalidate = 60;

function pickHeroImages(
  services: { id: string; photoPath: string | null }[],
  photoUrls: Map<string, string>,
  portfolio: { url: string }[],
): { coverUrl?: string; avatarUrl?: string } {
  const serviceWithPhoto = services.find((s) => photoUrls.has(s.id));
  // Portfolio shots are usually single finished results; service uploads are often
  // square before/after composites that look duplicated in a wide hero crop.
  const coverUrl =
    portfolio[0]?.url ||
    (serviceWithPhoto && photoUrls.get(serviceWithPhoto.id)) ||
    undefined;
  const avatarUrl =
    (serviceWithPhoto && photoUrls.get(serviceWithPhoto.id)) || portfolio[0]?.url || undefined;
  return { coverUrl, avatarUrl };
}

function buildOpeningHours(hours: Awaited<ReturnType<typeof listWorkingHours>>) {
  const hhmm = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return [1, 2, 3, 4, 5, 6, 0].map((weekday) => {
    const row = hours.find((h) => h.weekday === weekday);
    return {
      label: dayNames[weekday],
      value: row?.enabled ? `${hhmm(row.startMinutes)} - ${hhmm(row.endMinutes)}` : "Closed",
    };
  });
}

export default async function PublicBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ service?: string; date?: string; slot?: string; err?: string; wl?: string }>;
}) {
  const { handle } = await params;
  const sp = await searchParams;
  const sb = supabaseService();
  const tech = await getTechByHandle(sb, handle);
  if (!tech) notFound();

  trackPageView({ techId: tech.id, path: `/${handle}` });

  const [categories, services] = await Promise.all([
    listCategories(sb, tech.id),
    listServices(sb, tech.id, { activeOnly: true }),
  ]);
  const selected = sp.service ? services.find((s) => s.id === sp.service) ?? null : null;

  const live = isLive(tech);
  let days: DayOption[] = [];
  let questions: ConsultationQuestion[] = [];
  let addons: ServiceAddon[] = [];
  if (selected && live) {
    const rangeEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const [workingHours, timeOff, bookings, qs, adds] = await Promise.all([
      listWorkingHours(sb, tech.id),
      listTimeOff(sb, tech.id),
      listBlockingBookingsInRange(sb, tech.id, new Date().toISOString(), rangeEnd),
      listQuestions(sb, tech.id, { activeOnly: true }),
      addonsForService(sb, selected.id, { activeOnly: true }),
    ]);
    days = availableDays(selected, { workingHours, timeOff, bookings }, 14);
    questions = qs;
    addons = adds;
  }

  const photoUrls = new Map<string, string>();
  let openingHours: { label: string; value: string }[] = [];
  let reviews: { review: Review; clientLabel: string }[] = [];
  let ratingAvg = 0;
  let ratingCount = 0;
  let portfolio: { id: string; url: string; kind: string }[] = [];
  let selectedPhotoUrl: string | undefined;

  if (!selected) {
    const [hours, approvedReviews, allPhotos] = await Promise.all([
      listWorkingHours(sb, tech.id),
      listApprovedReviews(sb, tech.id).catch(() => []),
      listClientPhotosForTech(sb, tech.id).catch(() => []),
    ]);

    const consented = allPhotos.filter((p) => p.consent && p.kind !== "other").slice(0, 8);
    const photoPaths = [
      ...services.filter((s) => s.photoPath).map((s) => s.photoPath!),
      ...consented.map((p) => p.path),
    ];
    const signed = await signedPhotoUrls(photoPaths);
    for (const s of services) {
      if (s.photoPath) {
        const url = signed.get(s.photoPath);
        if (url) photoUrls.set(s.id, url);
      }
    }

    const clientById = await getClientNameMap(
      sb,
      approvedReviews.map((r) => r.clientId),
    );
    ratingCount = approvedReviews.length;
    ratingAvg = ratingCount
      ? approvedReviews.reduce((s, r) => s + r.rating, 0) / ratingCount
      : 0;
    reviews = approvedReviews.slice(0, 6).map((review) => {
      const name = clientById.get(review.clientId) ?? "";
      const [first = "", last = ""] = name.split(" ");
      return { review, clientLabel: last ? `${first} ${last[0]}.` : first || "A client" };
    });

    portfolio = consented
      .map((p) => {
        const url = signed.get(p.path);
        return url ? { id: p.id, url, kind: p.kind } : null;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    openingHours = buildOpeningHours(hours);
  } else if (selected.photoPath) {
    const signed = await signedPhotoUrls([selected.photoPath]);
    selectedPhotoUrl = signed.get(selected.photoPath);
  }

  const brand = tech.brandColor || "#db2777";
  const minPrice = services.length
    ? Math.min(...services.map((s) => s.pricePennies))
    : 0;
  const heroImages = !selected
    ? pickHeroImages(services, photoUrls, portfolio)
    : { coverUrl: selectedPhotoUrl, avatarUrl: selectedPhotoUrl };

  return (
    <div className="min-h-screen bg-cream pb-24 lg:pb-16">
      <BookingHero
        businessName={tech.businessName}
        bio={tech.bio || undefined}
        brand={brand}
        coverUrl={heroImages.coverUrl}
        avatarUrl={heroImages.avatarUrl}
        location={tech.location || undefined}
        instagram={tech.instagram || undefined}
        ratingAvg={ratingAvg}
        ratingCount={ratingCount}
      />

      <main className="mx-auto max-w-2xl px-4">
        {!selected ? (
          <div className="-mt-6 space-y-10 sm:-mt-8">
            {portfolio.length > 0 && <PortfolioGallery items={portfolio} />}

            {reviews.length > 0 && (
              <ReviewsSection reviews={reviews} ratingAvg={ratingAvg} ratingCount={ratingCount} />
            )}

            <ServiceMenu
              categories={categories}
              services={services}
              handle={tech.handle}
              brand={brand}
              photoUrls={photoUrls}
            />

            <OpeningHours hours={openingHours} />

            <StickyBookCta
              minPriceLabel={gbp(minPrice)}
              brand={brand}
              serviceCount={services.length}
            />
          </div>
        ) : (
          <div className="-mt-6 sm:-mt-8">
            <BookingStepInteractive
              tech={tech}
              service={selected}
              brand={brand}
              days={days}
              live={live}
              questions={questions}
              addons={addons}
              err={sp.err}
              wl={sp.wl}
              initialDate={sp.date}
              initialSlot={sp.slot}
              photoUrl={selectedPhotoUrl}
            />
          </div>
        )}
      </main>

      <footer className="mx-auto mt-14 max-w-2xl px-4 pb-6 text-center text-xs text-ink-faint">
        <p>
          No hidden fees · deposits shown upfront · powered by{" "}
          <Link href="/" className="font-medium text-brand-400 hover:text-brand-300">
            Glow
          </Link>
        </p>
      </footer>
    </div>
  );
}
