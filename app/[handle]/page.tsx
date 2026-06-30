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
} from "lucide-react";
import {
  getService,
  getTechByHandle,
  listCategories,
  listServices,
} from "@/lib/db/repo";
import { availableDays, daySlots, depositFor } from "@/lib/rules";
import { hydrate } from "@/lib/db/store";
import { gbp, minutesToLabel, fmtTime, TZ } from "@/lib/format";
import { formatInTimeZone } from "date-fns-tz";
import type { Service, Tech } from "@/lib/db/types";
import { createPublicBookingAction } from "./actions";

const ERboth: Record<string, string> = {
  missing: "Please fill in your name and email.",
  slot: "Sorry, that time was just taken. Please pick another slot.",
  blocked:
    "We can't complete this booking online. Please contact the studio directly.",
  patch:
    "This service needs a valid patch test on file at least 24-48h before your appointment. Please get in touch to arrange one first.",
  infill:
    "Infills are only available to returning clients within the rebooking window. Please book a full set instead.",
};

export default async function PublicBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{
    service?: string;
    date?: string;
    slot?: string;
    err?: string;
  }>;
}) {
  const { handle } = await params;
  const sp = await searchParams;
  await hydrate();
  const tech = getTechByHandle(handle);
  if (!tech) notFound();

  const categories = listCategories(tech.id);
  const services = listServices(tech.id, { activeOnly: true });
  const selected =
    sp.service && services.find((s) => s.id === sp.service)
      ? getService(sp.service)!
      : null;

  const brand = tech.brandColor || "#db2777";

  return (
    <div className="min-h-screen bg-cream pb-16">
      {/* Brand header */}
      <header
        className="px-4 py-12 text-white"
        style={{
          background: `linear-gradient(135deg, ${brand}, ${shade(brand, -28)})`,
        }}
      >
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/15 text-2xl font-semibold backdrop-blur">
            {initials(tech.businessName)}
          </div>
          <h1 className="mt-4 font-display text-3xl font-semibold">
            {tech.businessName}
          </h1>
          {tech.bio && (
            <p className="mx-auto mt-2 max-w-md text-sm text-white/85">{tech.bio}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-white/85">
            {tech.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {tech.location}
              </span>
            )}
            {tech.instagram && (
              <a
                className="flex items-center gap-1 hover:text-white"
                href={`https://instagram.com/${tech.instagram}`}
                target="_blank"
              >
                <Instagram className="h-4 w-4" /> @{tech.instagram}
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto mt-8 max-w-2xl px-4">
        {!selected ? (
          <ServiceMenu
            categories={categories}
            services={services}
            handle={tech.handle}
            brand={brand}
          />
        ) : (
          <BookingStep
            tech={tech}
            service={selected}
            sp={sp}
            brand={brand}
          />
        )}
      </main>

      <footer className="mx-auto mt-12 max-w-2xl px-4 text-center text-xs text-ink-faint">
        <p>
          No hidden fees · deposits are shown upfront · powered by{" "}
          <Link href="/" className="font-medium text-brand-600">
            Glow
          </Link>
        </p>
      </footer>
    </div>
  );
}

function ServiceMenu({
  categories,
  services,
  handle,
  brand,
}: {
  categories: { id: string; name: string }[];
  services: ReturnType<typeof listServices>;
  handle: string;
  brand: string;
}) {
  if (services.length === 0) {
    return (
      <div className="card p-8 text-center text-ink-soft">
        This studio hasn&apos;t published any services yet.
      </div>
    );
  }
  return (
    <div className="space-y-8 animate-fade-in">
      {categories
        .filter((c) => services.some((s) => s.categoryId === c.id))
        .map((cat) => (
          <section key={cat.id}>
            <h2 className="mb-3 font-display text-xl font-semibold">{cat.name}</h2>
            <div className="space-y-3">
              {services
                .filter((s) => s.categoryId === cat.id)
                .map((s) => (
                  <Link
                    key={s.id}
                    href={`/${handle}?service=${s.id}`}
                    className="card flex items-center justify-between gap-4 p-4 transition hover:shadow-soft"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{s.name}</p>
                      {s.description && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">
                          {s.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {minutesToLabel(s.durationMin)}
                        </span>
                        <span className="font-medium text-ink">{gbp(s.pricePennies)}</span>
                        {depositFor(s) > 0 && <span>{gbp(depositFor(s))} deposit</span>}
                        {s.requiresPatchTest && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <ShieldCheck className="h-3.5 w-3.5" /> patch test
                          </span>
                        )}
                        {s.isInfill && (
                          <span className="flex items-center gap-1 text-violet-600">
                            <RefreshCw className="h-3.5 w-3.5" /> returning clients
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className="shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                      style={{ backgroundColor: brand }}
                    >
                      Book
                    </span>
                  </Link>
                ))}
            </div>
          </section>
        ))}
    </div>
  );
}

function BookingStep({
  tech,
  service,
  sp,
  brand,
}: {
  tech: Tech;
  service: Service;
  sp: { date?: string; slot?: string; err?: string };
  brand: string;
}) {
  const t = tech;
  const deposit = depositFor(service);
  const balance = Math.max(0, service.pricePennies - deposit);
  const days = availableDays(t.id, service, 14);
  const activeDate = sp.date && days.some((d) => d.dateStr === sp.date)
    ? sp.date
    : days[0]?.dateStr;
  const slots = activeDate ? daySlots(t.id, service, activeDate) : [];

  return (
    <div className="space-y-5 animate-fade-in">
      <Link
        href={`/${t.handle}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> All services
      </Link>

      {/* Service summary */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold">{service.name}</h2>
            {service.description && (
              <p className="mt-1 text-sm text-ink-soft">{service.description}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold">{gbp(service.pricePennies)}</p>
            <p className="text-xs text-ink-faint">{minutesToLabel(service.durationMin)}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-cream p-3 text-sm sm:grid-cols-3">
          <Stat label="Deposit now" value={deposit > 0 ? gbp(deposit) : "None"} />
          <Stat label="Balance on the day" value={gbp(balance)} />
          <Stat label="Cancellation" value={`${t.cancellationWindowHours}h notice`} />
        </div>
        {(service.requiresPatchTest || service.isInfill) && (
          <div className="mt-3 space-y-2">
            {service.requiresPatchTest && (
              <Notice tone="amber" icon={<ShieldCheck className="h-4 w-4" />}>
                A valid patch test is required before this service.
              </Notice>
            )}
            {service.isInfill && (
              <Notice tone="violet" icon={<RefreshCw className="h-4 w-4" />}>
                Infills are for returning clients within {service.infillMaxGapDays}{" "}
                days of their last appointment.
              </Notice>
            )}
          </div>
        )}
      </div>

      {sp.err && ERboth[sp.err] && (
        <Notice tone="red" icon={<AlertTriangle className="h-4 w-4" />}>
          {ERboth[sp.err]}
        </Notice>
      )}

      {/* Date + slot picker */}
      {days.length === 0 ? (
        <div className="card p-6 text-center text-sm text-ink-soft">
          No available times in the next two weeks. Please check back soon.
        </div>
      ) : (
        <div className="card p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <Calendar className="h-4 w-4 text-brand-600" /> Pick a date
          </h3>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {days.map((d) => {
              const isActive = d.dateStr === activeDate;
              return (
                <Link
                  key={d.dateStr}
                  href={`/${t.handle}?service=${service.id}&date=${d.dateStr}`}
                  scroll={false}
                  className="flex min-w-[64px] flex-col items-center rounded-xl border px-3 py-2 text-center text-sm transition"
                  style={
                    isActive
                      ? { backgroundColor: brand, borderColor: brand, color: "white" }
                      : { borderColor: "rgba(0,0,0,0.08)" }
                  }
                >
                  <span className="text-xs opacity-80">
                    {formatInTimeZone(new Date(`${d.dateStr}T12:00:00Z`), TZ, "EEE")}
                  </span>
                  <span className="text-lg font-semibold">
                    {formatInTimeZone(new Date(`${d.dateStr}T12:00:00Z`), TZ, "d")}
                  </span>
                  <span className="text-[10px] opacity-80">
                    {formatInTimeZone(new Date(`${d.dateStr}T12:00:00Z`), TZ, "MMM")}
                  </span>
                </Link>
              );
            })}
          </div>

          <h3 className="mt-5 font-semibold">Pick a time</h3>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((slot) => {
              const isActive = slot === sp.slot;
              return (
                <Link
                  key={slot}
                  href={`/${t.handle}?service=${service.id}&date=${activeDate}&slot=${encodeURIComponent(slot)}`}
                  scroll={false}
                  className="rounded-xl border py-2.5 text-center text-sm font-medium transition"
                  style={
                    isActive
                      ? { backgroundColor: brand, borderColor: brand, color: "white" }
                      : { borderColor: "rgba(0,0,0,0.08)" }
                  }
                >
                  {fmtTime(slot)}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Details + deposit */}
      {sp.slot && (
        <div className="card p-5">
          <h3 className="font-semibold">Your details</h3>
          <p className="mt-0.5 text-sm text-ink-soft">
            Booking {service.name} on{" "}
            <strong>
              {formatInTimeZone(new Date(sp.slot), TZ, "EEE d MMM 'at' HH:mm")}
            </strong>
          </p>
          <form action={createPublicBookingAction} className="mt-4 space-y-3">
            <input type="hidden" name="handle" value={t.handle} />
            <input type="hidden" name="serviceId" value={service.id} />
            <input type="hidden" name="slot" value={sp.slot} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="name" required placeholder="Full name" className="input" />
              <input name="email" type="email" required placeholder="Email" className="input" />
            </div>
            <input name="phone" placeholder="Mobile number" className="input" />
            <label className="flex items-start gap-2.5 text-sm text-ink-soft">
              <input type="checkbox" required className="mt-1 h-4 w-4 rounded border-black/20 text-brand-600 focus:ring-brand-300" />
              <span>
                I agree to the {t.cancellationWindowHours}h cancellation policy. My{" "}
                {deposit > 0 ? gbp(deposit) + " deposit" : "deposit"} secures the slot
                and is deducted from the total.
              </span>
            </label>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white"
              style={{ backgroundColor: brand }}
            >
              <Lock className="h-4 w-4" />
              {deposit > 0
                ? `Pay ${gbp(deposit)} deposit & book`
                : "Confirm booking"}
            </button>
            <p className="text-center text-xs text-ink-faint">
              Test mode — no real payment is taken.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function Notice({
  tone,
  icon,
  children,
}: {
  tone: "amber" | "violet" | "red";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const map = {
    amber: "bg-amber-50 text-amber-800",
    violet: "bg-violet-50 text-violet-800",
    red: "bg-red-50 text-red-700",
  };
  return (
    <div className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ${map[tone]}`}>
      <span className="mt-0.5">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

// ----- small visual helpers -----
function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function shade(hex: string, percent: number): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const num = parseInt(m, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.min(255, Math.round(r + (r * percent) / 100)));
  g = Math.max(0, Math.min(255, Math.round(g + (g * percent) / 100)));
  b = Math.max(0, Math.min(255, Math.round(b + (b * percent) / 100)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
