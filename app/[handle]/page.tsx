import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Instagram,
  MapPin,
  Clock,
  ShieldCheck,
  RefreshCw,
  ArrowLeft,
  Calendar,
  AlertTriangle,
  Lock,
  Star,
  Sparkles,
} from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { supabaseService } from "@/lib/supabase/service";
import {
  listBookings,
  listCategories,
  listQuestions,
  listServices,
  listTimeOff,
  listWorkingHours,
  getTechByHandle,
  addonsForService,
  listApprovedReviews,
  listClients,
  listClientPhotosForTech,
} from "@/lib/db/queries";
import { signedPhotoUrl } from "@/lib/storage";
import { availableDays, depositFor } from "@/lib/rules";
import { SubmitButton } from "@/components/ui/submit-button";
import { YesNoQuestion } from "@/components/booking/yesno-question";
import { isLive } from "@/lib/subscriptions";
import { gbp, minutesToLabel, fmtTime, TZ } from "@/lib/format";
import type { ConsultationQuestion, Review, Service, ServiceAddon, ServiceCategory, Tech } from "@/lib/db/types";
import { createPublicBookingAction, joinWaitlistAction } from "./actions";

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

const ERR: Record<string, string> = {
  missing: "Please fill in your name and email.",
  slot: "Sorry, that time was just taken. Please pick another slot.",
  not_live: "This studio isn't accepting online bookings just yet. Please check back soon.",
  blocked: "We can't complete this booking online. Please contact the studio directly.",
  patch: "This service needs a valid patch test on file. Please get in touch to arrange one first.",
  infill: "Infills are only available to returning clients within the rebooking window. Please book a full set instead.",
  form: "Please complete the required questions and agree to the booking policy.",
};

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
    const [workingHours, timeOff, bookings, qs, adds] = await Promise.all([
      listWorkingHours(sb, tech.id),
      listTimeOff(sb, tech.id),
      listBookings(sb, tech.id),
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
    const [, hours, approvedReviews, clients, allPhotos] = await Promise.all([
      Promise.all(
        services
          .filter((s) => s.photoPath)
          .map(async (s) => {
            const url = await signedPhotoUrl(s.photoPath!);
            if (url) photoUrls.set(s.id, url);
          }),
      ),
      listWorkingHours(sb, tech.id),
      listApprovedReviews(sb, tech.id).catch(() => []),
      listClients(sb, tech.id),
      listClientPhotosForTech(sb, tech.id).catch(() => []),
    ]);

    const clientById = new Map(clients.map((c) => [c.id, c.name]));
    ratingCount = approvedReviews.length;
    ratingAvg = ratingCount
      ? approvedReviews.reduce((s, r) => s + r.rating, 0) / ratingCount
      : 0;
    reviews = approvedReviews.slice(0, 6).map((review) => {
      const name = clientById.get(review.clientId) ?? "";
      const [first = "", last = ""] = name.split(" ");
      return { review, clientLabel: last ? `${first} ${last[0]}.` : first || "A client" };
    });

    // Portfolio: consented before/after photos only.
    const consented = allPhotos.filter((p) => p.consent && p.kind !== "other").slice(0, 8);
    portfolio = (
      await Promise.all(
        consented.map(async (p) => {
          const url = await signedPhotoUrl(p.path);
          return url ? { id: p.id, url, kind: p.kind } : null;
        }),
      )
    ).filter((p): p is NonNullable<typeof p> => p !== null);
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
                    <div key={p.id} className="relative overflow-hidden rounded-xl border border-edge">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={`${p.kind} photo`} className="aspect-square w-full object-cover" loading="lazy" />
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
          <BookingStep tech={tech} service={selected} sp={sp} brand={brand} days={days} live={live} questions={questions} addons={addons} />
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
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrls.get(s.id)!}
                    alt={s.name}
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

function BookingStep({ tech, service, sp, brand, days, live, questions, addons }: { tech: Tech; service: Service; sp: { date?: string; slot?: string; err?: string; wl?: string }; brand: string; days: DayOption[]; live: boolean; questions: ConsultationQuestion[]; addons: ServiceAddon[]; }) {
  const deposit = depositFor(service);
  const balance = Math.max(0, service.pricePennies - deposit);
  const activeDate = sp.date && days.some((d) => d.dateStr === sp.date) ? sp.date : days[0]?.dateStr;
  const slots = activeDate ? days.find((d) => d.dateStr === activeDate)?.slots ?? [] : [];

  return (
    <div className="space-y-5 animate-fade-in">
      <Link href={`/${tech.handle}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"><ArrowLeft className="h-4 w-4" /> All services</Link>

      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold">{service.name}</h2>
            {service.description && <p className="mt-1 text-sm text-ink-soft">{service.description}</p>}
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold">{gbp(service.pricePennies)}</p>
            <p className="text-xs text-ink-faint">{minutesToLabel(service.durationMin)}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-cream p-3 text-sm sm:grid-cols-3">
          <Stat label="Deposit now" value={deposit > 0 ? gbp(deposit) : "None"} />
          <Stat label="Balance on the day" value={gbp(balance)} />
          <Stat label="Cancellation" value={`${tech.cancellationWindowHours}h notice`} />
        </div>
        {(service.requiresPatchTest || service.isInfill) && (
          <div className="mt-3 space-y-2">
            {service.requiresPatchTest && <Notice tone="amber" icon={<ShieldCheck className="h-4 w-4" />}>A valid patch test is required before this service.</Notice>}
            {service.isInfill && <Notice tone="violet" icon={<RefreshCw className="h-4 w-4" />}>Infills are for returning clients within {service.infillMaxGapDays} days of their last appointment.</Notice>}
          </div>
        )}
      </div>

      {sp.err && ERR[sp.err] && <Notice tone="red" icon={<AlertTriangle className="h-4 w-4" />}>{ERR[sp.err]}</Notice>}

      {!live && (
        <Notice tone="amber" icon={<AlertTriangle className="h-4 w-4" />}>
          This studio isn&apos;t accepting online bookings just yet. Please check back soon.
        </Notice>
      )}

      {sp.wl === "1" && (
        <Notice tone="amber" icon={<Calendar className="h-4 w-4" />}>
          You&apos;re on the cancellation list! We&apos;ll email you the moment a slot frees up.
        </Notice>
      )}

      {live && (days.length === 0 ? (
        <div className="card p-6 text-center text-sm text-ink-soft">No available times in the next two weeks. Please check back soon.</div>
      ) : (
        <div className="card p-5">
          <h3 className="flex items-center gap-2 font-semibold"><Calendar className="h-4 w-4 text-brand-400" /> Pick a date</h3>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {days.map((d) => {
              const isActive = d.dateStr === activeDate;
              return (
                <Link key={d.dateStr} href={`/${tech.handle}?service=${service.id}&date=${d.dateStr}`} scroll={false} className="flex min-w-[64px] flex-col items-center rounded-xl border px-3 py-2 text-center text-sm transition" style={isActive ? { backgroundColor: brand, borderColor: brand, color: "white" } : { borderColor: "rgba(255,255,255,0.14)" }}>
                  <span className="text-xs opacity-80">{formatInTimeZone(new Date(`${d.dateStr}T12:00:00Z`), TZ, "EEE")}</span>
                  <span className="text-lg font-semibold">{formatInTimeZone(new Date(`${d.dateStr}T12:00:00Z`), TZ, "d")}</span>
                  <span className="text-[10px] opacity-80">{formatInTimeZone(new Date(`${d.dateStr}T12:00:00Z`), TZ, "MMM")}</span>
                </Link>
              );
            })}
          </div>

          <h3 className="mt-5 font-semibold">Pick a time</h3>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((slot) => {
              const isActive = slot === sp.slot;
              return (
                <Link key={slot} href={`/${tech.handle}?service=${service.id}&date=${activeDate}&slot=${encodeURIComponent(slot)}`} scroll={false} className="rounded-xl border py-2.5 text-center text-sm font-medium transition" style={isActive ? { backgroundColor: brand, borderColor: brand, color: "white" } : { borderColor: "rgba(255,255,255,0.14)" }}>
                  {fmtTime(slot)}
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {live && sp.wl !== "1" && (
        <details className="card">
          <summary className="cursor-pointer list-none p-4 text-sm font-medium text-ink-soft">
            Can&apos;t see a time that works? <span style={{ color: brand }}>Join the cancellation list</span>
          </summary>
          <form action={joinWaitlistAction} className="space-y-3 border-t border-edge p-4">
            <input type="hidden" name="handle" value={tech.handle} />
            <input type="hidden" name="serviceId" value={service.id} />
            <p className="text-sm text-ink-soft">
              Leave your details and we&apos;ll email you the moment someone cancels.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="name" required placeholder="Full name *" className="input" />
              <input name="email" type="email" required placeholder="Email *" className="input" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="phone" placeholder="Mobile number" className="input" />
              <div>
                <input name="date" type="date" className="input" />
                <p className="mt-1 text-xs text-ink-faint">Only want a certain day? Pick it - or leave blank for any day.</p>
              </div>
            </div>
            <SubmitButton className="w-full bg-none py-3 font-semibold shadow-none" style={{ backgroundColor: brand }} pendingLabel="Adding you…">
              Join the cancellation list
            </SubmitButton>
          </form>
        </details>
      )}

      {live && sp.slot && (
        <div className="card p-5">
          <h3 className="font-semibold">Your details</h3>
          <p className="mt-0.5 text-sm text-ink-soft">Booking {service.name} on <strong>{formatInTimeZone(new Date(sp.slot), TZ, "EEE d MMM 'at' HH:mm")}</strong></p>
          <form action={createPublicBookingAction} className="mt-4 space-y-3">
            <input type="hidden" name="handle" value={tech.handle} />
            <input type="hidden" name="serviceId" value={service.id} />
            <input type="hidden" name="slot" value={sp.slot} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="name" required placeholder="Full name *" className="input" />
              <input name="email" type="email" required placeholder="Email *" className="input" />
            </div>
            <input name="phone" placeholder="Mobile number" className="input" />

            {addons.length > 0 && (
              <div className="space-y-2 border-t border-edge pt-3">
                <p className="text-sm font-medium text-ink">Extras (optional)</p>
                {addons.map((a) => (
                  <label key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-white/[0.03] px-4 py-3 text-sm">
                    <span className="flex items-center gap-2.5">
                      <input type="checkbox" name={`addon_${a.id}`} className="h-4 w-4 rounded border-white/20 text-brand-400 focus:ring-brand-300" />
                      {a.name}
                    </span>
                    <span className="font-medium">+{gbp(a.pricePennies)}</span>
                  </label>
                ))}
                <p className="text-xs text-ink-faint">Extras are added to your balance on the day.</p>
              </div>
            )}

            {questions.length > 0 && (
              <div className="space-y-3 border-t border-edge pt-3">
                <p className="text-sm font-medium text-ink">A few quick questions</p>
                {questions.map((q) => (
                  <div key={q.id}>
                    <label className="mb-1 block text-sm text-ink-soft">
                      {q.prompt}{q.required && <span className="text-red-500"> *</span>}
                    </label>
                    {q.type === "longtext" ? (
                      <textarea name={`q_${q.id}`} required={q.required} className="input min-h-[70px]" />
                    ) : q.type === "yesno" ? (
                      <YesNoQuestion name={`q_${q.id}`} required={q.required} />
                    ) : (
                      <input name={`q_${q.id}`} required={q.required} className="input" />
                    )}
                  </div>
                ))}
              </div>
            )}

            <label className="flex items-start gap-2.5 text-sm text-ink-soft">
              <input name="policyAccepted" type="checkbox" required className="mt-1 h-4 w-4 rounded border-white/20 text-brand-400 focus:ring-brand-300" />
              <span>
                I agree to the {tech.cancellationWindowHours}h cancellation policy and Glow&apos;s{" "}
                <Link href="/terms" className="text-brand-400 underline-offset-2 hover:underline">terms</Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-brand-400 underline-offset-2 hover:underline">privacy policy</Link>.
                {" "}My {deposit > 0 ? gbp(deposit) + " deposit" : "deposit"} secures the slot and is deducted from the total.
              </span>
            </label>
            <SubmitButton
              className="w-full bg-none py-3 font-semibold shadow-none"
              style={{ backgroundColor: brand }}
              pendingLabel="Securing your slot…"
            >
              <Lock className="h-4 w-4" />
              {deposit > 0 ? `Pay ${gbp(deposit)} deposit & book` : "Confirm booking"}
            </SubmitButton>
            {(process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test") && (
              <p className="text-center text-xs text-ink-faint">Test mode - no real payment is taken.</p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-ink-faint">{label}</p><p className="font-semibold">{value}</p></div>;
}

function Notice({ tone, icon, children }: { tone: "amber" | "violet" | "red"; icon: React.ReactNode; children: React.ReactNode; }) {
  const map = { amber: "bg-amber-500/10 text-amber-800", violet: "bg-violet-50 text-violet-800", red: "bg-red-500/10 text-red-300" };
  return <div className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ${map[tone]}`}><span className="mt-0.5">{icon}</span><span>{children}</span></div>;
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
