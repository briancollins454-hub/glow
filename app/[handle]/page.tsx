import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Instagram,
  MapPin,
  Clock,
  ShieldCheck,
  RefreshCw,
  Star,
  Sparkles,
} from "lucide-react";
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
import { availableDays, depositFor } from "@/lib/rules";
import { isLive } from "@/lib/subscriptions";
import { gbp, minutesToLabel } from "@/lib/format";
import type { ConsultationQuestion, Review, Service, ServiceAddon, ServiceCategory, Tech } from "@/lib/db/types";
import { BookingStepInteractive } from "@/components/booking/booking-step-interactive";
import { RemoteImage } from "@/components/ui/remote-image";

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

// Menu content (services, reviews, portfolio) can be cached briefly.
export const revalidate = 60;

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

  // Signed URLs for service photos + opening hours + social proof (menu view only).
  const photoUrls = new Map<string, string>();
  let openingHours: { label: string; value: string }[] = [];
  let reviews: { review: Review; clientLabel: string }[] = [];
  let ratingAvg = 0;
  let ratingCount = 0;
  let portfolio: { id: string; url: string; kind: string }[] = [];
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
    const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    // Monday-first display order
    openingHours = [1, 2, 3, 4, 5, 6, 0].map((weekday) => {
      const row = hours.find((h) => h.weekday === weekday);
      return {
        label: dayNames[weekday],
        value: row?.enabled ? `${hhmm(row.startMinutes)} - ${hhmm(row.endMinutes)}` : "Closed",
      };
    });
  }

  const brand = tech.brandColor || "#db2777";

  return (
    <div className="min-h-screen bg-cream pb-16">
      <header className="px-4 py-12 text-white" style={{ background: `linear-gradient(135deg, ${brand}, ${shade(brand, -28)})` }}>
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/15 text-2xl font-semibold backdrop-blur">{initials(tech.businessName)}</div>
          <h1 className="mt-4 font-display text-3xl font-semibold">{tech.businessName}</h1>
          {tech.bio && <p className="mx-auto mt-2 max-w-md text-sm text-white/85">{tech.bio}</p>}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-white/85">
            {ratingCount > 0 && (
              <span className="flex items-center gap-1 font-medium text-white">
                <Star className="h-4 w-4 fill-amber-300 text-amber-300" />
                {ratingAvg.toFixed(1)} ({ratingCount} review{ratingCount > 1 ? "s" : ""})
              </span>
            )}
            {tech.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {tech.location}</span>}
            {tech.instagram && <a className="flex items-center gap-1 hover:text-white" href={`https://instagram.com/${tech.instagram}`} target="_blank"><Instagram className="h-4 w-4" /> @{tech.instagram}</a>}
          </div>
        </div>
      </header>

      <main className="mx-auto mt-8 max-w-2xl px-4">
        {!selected ? (
          <>
            <ServiceMenu categories={categories} services={services} handle={tech.handle} brand={brand} photoUrls={photoUrls} />

            {portfolio.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-semibold">
                  <Sparkles className="h-5 w-5 text-brand-400" /> Recent work
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {portfolio.map((p) => (
                    <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl border border-edge">
                      <RemoteImage
                        src={p.url}
                        alt={`${p.kind} photo`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 25vw"
                      />
                      <span className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium capitalize text-white">{p.kind}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {reviews.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-semibold">
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" /> What clients say
                </h2>
                <div className="space-y-3">
                  {reviews.map(({ review, clientLabel }) => (
                    <div key={review.id} className="card p-4">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} className={`h-3.5 w-3.5 ${n <= review.rating ? "fill-amber-400 text-amber-400" : "text-ink-faint"}`} />
                          ))}
                        </span>
                        <p className="text-sm font-medium">{clientLabel}</p>
                      </div>
                      {review.comment && <p className="mt-1.5 text-sm text-ink-soft">&ldquo;{review.comment}&rdquo;</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {openingHours.some((d) => d.value !== "Closed") && (
              <section className="card mt-8 p-5">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <Clock className="h-4 w-4 text-brand-400" /> Opening hours
                </h2>
                <dl className="mt-3 space-y-1.5 text-sm">
                  {openingHours.map((d) => (
                    <div key={d.label} className="flex items-center justify-between">
                      <dt className="text-ink-soft">{d.label}</dt>
                      <dd className={d.value === "Closed" ? "text-ink-faint" : "font-medium"}>{d.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </>
        ) : (
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
          />
        )}
      </main>

      <footer className="mx-auto mt-12 max-w-2xl px-4 text-center text-xs text-ink-faint">
        <p>No hidden fees · deposits are shown upfront · powered by <Link href="/" className="font-medium text-brand-400">Glow</Link></p>
      </footer>
    </div>
  );
}

function ServiceMenu({ categories, services, handle, brand, photoUrls }: { categories: ServiceCategory[]; services: Service[]; handle: string; brand: string; photoUrls: Map<string, string>; }) {
  if (services.length === 0) {
    return <div className="card p-8 text-center text-ink-soft">This studio hasn&apos;t published any services yet.</div>;
  }
  return (
    <div className="space-y-8 animate-fade-in">
      {categories.filter((c) => services.some((s) => s.categoryId === c.id)).map((cat) => (
        <section key={cat.id}>
          <h2 className="mb-3 font-display text-xl font-semibold">{cat.name}</h2>
          <div className="space-y-3">
            {services.filter((s) => s.categoryId === cat.id).map((s) => (
              <Link key={s.id} href={`/${handle}?service=${s.id}`} className="card flex items-center justify-between gap-4 p-4 transition hover:shadow-soft">
                {photoUrls.has(s.id) && (
                  <RemoteImage
                    src={photoUrls.get(s.id)!}
                    alt={s.name}
                    width={64}
                    height={64}
                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.name}</p>
                  {s.description && <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{s.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{minutesToLabel(s.durationMin)}</span>
                    <span className="font-medium text-ink">{gbp(s.pricePennies)}</span>
                    {depositFor(s) > 0 && <span>{gbp(depositFor(s))} deposit</span>}
                    {s.requiresPatchTest && <span className="flex items-center gap-1 text-amber-300"><ShieldCheck className="h-3.5 w-3.5" /> patch test</span>}
                    {s.isInfill && <span className="flex items-center gap-1 text-violet-300"><RefreshCw className="h-3.5 w-3.5" /> returning clients</span>}
                  </div>
                </div>
                <span className="shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: brand }}>Book</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function shade(hex: string, percent: number): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const num = parseInt(m, 16);
  let r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  r = Math.max(0, Math.min(255, Math.round(r + (r * percent) / 100)));
  g = Math.max(0, Math.min(255, Math.round(g + (g * percent) / 100)));
  b = Math.max(0, Math.min(255, Math.round(b + (b * percent) / 100)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
