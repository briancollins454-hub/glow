import type { Metadata } from "next";
import Link from "next/link";
import {
  Ban,
  BellRing,
  CalendarHeart,
  CheckCircle2,
  FileDown,
  Globe,
  Palette,
  ShieldCheck,
  Sparkles,
  Upload,
  Wallet,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ComparisonTable } from "@/components/marketing/comparison-table";
import { StickyMobileCta } from "@/components/marketing/sticky-mobile-cta";
import { PageViewBeacon } from "@/components/analytics/page-view-beacon";

export const revalidate = 3600;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://glow-uk.com";
const APP_HOST = APP_URL.replace(/^https?:\/\//, "");

const META_DESCRIPTION =
  "UK booking for self-employed lash, nail and brow techs. Patch tests, deposits to your bank, 0% commission. £19/mo flat.";

export const metadata: Metadata = {
  title: "Booking system for lash, nail and brow techs UK",
  description: META_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "Glow",
    url: APP_URL,
    title: "Booking system for lash, nail and brow techs UK | Glow",
    description: META_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Booking system for lash, nail and brow techs UK | Glow",
    description: META_DESCRIPTION,
  },
};

const FAQ = [
  {
    q: "How does patch test gating work?",
    a: "Mark a service as needing a patch test. If the client has no valid pass on file, they cannot complete the booking. You record pass, fail, and expiry on their profile. When a test expires, booking is blocked until you log a new one.",
  },
  {
    q: "Who sets the patch test expiry window?",
    a: "You do, per category. Set 4, 6, 12 months or whatever your insurer requires. Glow uses that window to decide if a test is still valid.",
  },
  {
    q: "Where does deposit money go?",
    a: "Straight to your bank via Stripe Connect. Glow never holds your client payments. You connect Stripe once in the dashboard.",
  },
  {
    q: "Does Glow take commission on my bookings?",
    a: "No. Not on Instagram clients, not on word of mouth, not ever. You pay £19/mo flat. Your clients are yours.",
  },
  {
    q: "Can I switch from Fresha, Booksy or Square?",
    a: "Yes. Import services, clients and appointments by CSV. Glow supports export formats from Square, Booksy, Timely and Fresha. Preview before anything is saved.",
  },
  {
    q: "Is there a contract?",
    a: "No. Cancel any time from your billing page. Your data export is always available if you leave.",
  },
  {
    q: "Do you send SMS reminders?",
    a: "Email reminders are included: confirmation, 24-hour, balance due, aftercare, reviews and rebooking nudges. SMS for 24-hour and balance reminders works when SMS is configured on the platform.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Glow",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: APP_URL,
      description: META_DESCRIPTION,
      offers: {
        "@type": "Offer",
        price: "19.00",
        priceCurrency: "GBP",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      })),
    },
  ],
};

export default function LandingPage() {
  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <PageViewBeacon path="/" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="container-page flex items-center justify-between py-5 sm:py-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow">
            <CalendarHeart className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">Glow</span>
        </Link>
        <nav className="flex items-center gap-2">
          <ButtonLink href="/login" variant="ghost" size="sm">
            Log in
          </ButtonLink>
          <ButtonLink href="/signup" size="sm" className="hidden sm:inline-flex">
            Sign up
          </ButtonLink>
        </nav>
      </header>

      {/* 1. Hero */}
      <section className="container-page grid items-center gap-10 py-10 lg:grid-cols-2 lg:gap-12 lg:py-16">
        <div className="animate-fade-in">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-sm font-medium text-brand-text">
            <Sparkles className="h-4 w-4" /> Lash, nail and brow techs
          </span>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[3.25rem]">
            The booking system that actually understands beauty work.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
            Built for self-employed UK lash, nail and brow techs. £19/mo flat. 0% commission.
            Deposits go straight to your bank via Stripe. Never through us.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink href="/signup" size="lg" className="min-h-12">
              Start for £9.50
            </ButtonLink>
            <ButtonLink href="/bellarose" variant="outline" size="lg" className="min-h-12">
              See a live demo booking page
            </ButtonLink>
          </div>
          <p className="mt-3 text-sm text-ink-faint">50% off your first month, then £19/mo. Cancel any time.</p>
          <ul className="mt-6 flex flex-col gap-2 text-sm text-ink-soft sm:flex-row sm:flex-wrap sm:gap-x-6">
            {["0% commission", "Patch test gating built in", "Your clients stay yours"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-500" /> {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="animate-fade-in relative">
          <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-brand-600/20 blur-3xl" />
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white">
              <p className="text-sm opacity-90">{APP_HOST}/</p>
              <p className="font-display text-2xl font-semibold">bellarose</p>
              <p className="mt-1 text-sm opacity-90">Bella Rose Beauty · Manchester</p>
            </div>
            <div className="space-y-3 p-5 sm:p-6">
              {[
                { name: "Classic Full Set", meta: "2h · £55 · £16.50 deposit" },
                { name: "Classic Infill", meta: "Returning clients only · within 21 days" },
                { name: "Brow Lamination", meta: "Patch test required · blocked without valid test" },
              ].map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-cream px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{s.name}</p>
                    <p className="text-xs text-ink-faint">{s.meta}</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white">
                    Book
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Money angle */}
      <section className="container-page py-12 lg:py-16">
        <div className="card border-brand-500/25 bg-gradient-to-br from-brand-500/10 to-transparent p-8 sm:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <Wallet className="mx-auto h-8 w-8 text-brand-400" />
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Your money. Your clients. Your bank.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-soft sm:text-lg">
              Big platforms charge commission on &ldquo;new&rdquo; clients even when those clients came from your own
              Instagram or word of mouth. Some hold payouts. Some lock deposits behind £40+ plans.
            </p>
            <p className="mt-4 text-base font-medium leading-relaxed text-ink sm:text-lg">
              Glow: 0% commission. Stripe Connect pays straight to your bank. Deposits and no-show protection included
              at £19/mo. No marketplace. No poaching your regulars.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Compliance */}
      <section className="container-page py-12 lg:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-brand-400" />
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Stay insured. Prove it when it matters.
          </h2>
          <p className="mt-3 text-ink-soft">
            Patch tests are not admin. They are your insurance paperwork. Glow treats them that way.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {[
            {
              title: "Patch test gating",
              body: "Services that need a patch test cannot be booked without a valid pass on file. Full stop. No workaround for clients online.",
            },
            {
              title: "Expiry you control",
              body: "Set the re-test window per category to match your insurer. 4, 6, 12 months, whatever they require. Tests auto-expire and booking is blocked until you record a new one.",
            },
            {
              title: "Records per client",
              body: "Pass or fail, expiry date, consultation answers, aftercare sent, photos with consent. Everything on one profile if a claim ever lands.",
            },
            {
              title: "Ready for product changes",
              body: "The UK TPO ban is expected from September 2026. Techs will switch products and insurers will want fresh patch tests. Glow already tracks who needs re-testing and who is blocked from booking until you update their record.",
            },
          ].map((item) => (
            <div key={item.title} className="card p-6">
              <h3 className="text-lg font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Smart booking rules */}
      <section className="container-page py-12 lg:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Rules that protect your diary
          </h2>
          <p className="mt-3 text-ink-soft">Stop the bookings that waste your time before they land.</p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {[
            {
              icon: Sparkles,
              title: "Infill rules",
              body: "Returning clients only, within your window. No more new clients booking a £35 infill for a £55 full set.",
            },
            {
              icon: CheckCircle2,
              title: "Booking approval",
              body: "You approve or decline requests before any deposit is taken. New client at a weird hour? Your call.",
            },
            {
              icon: Ban,
              title: "Blocked clients",
              body: "Blocked clients cannot book online. No-show and warning badges on every profile so you see the risk before you reply.",
            },
            {
              icon: BellRing,
              title: "Waitlist",
              body: "Fully booked? Clients join the list and get emailed when a slot opens. You do not have to chase them.",
            },
          ].map((item) => (
            <div key={item.title} className="card p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/15 text-brand-text">
                <item.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Automations */}
      <section className="container-page py-12 lg:py-16">
        <div className="card p-8 sm:p-10">
          <div className="mx-auto max-w-2xl text-center">
            <BellRing className="mx-auto h-8 w-8 text-brand-400" />
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">
              The admin you stopped doing
            </h2>
            <p className="mt-3 text-ink-soft">Glow chases clients so you can stay at the chair.</p>
          </div>
          <ul className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-2">
            {[
              "Booking confirmation",
              "24-hour reminder",
              "Balance due reminder",
              "Aftercare email after the appointment",
              "Review request",
              "Rebooking nudge after 30 days",
              "Waitlist alert when a slot opens",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5 rounded-xl border border-edge bg-cream/60 px-4 py-3 text-sm text-ink-soft">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 6. Your brand */}
      <section className="container-page py-12 lg:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <Palette className="h-8 w-8 text-brand-400" />
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Your brand, not ours
            </h2>
            <p className="mt-4 text-ink-soft leading-relaxed">
              A branded mini site at {APP_HOST}/yourname. Your colours, banner, profile photo, gallery, reviews,
              Instagram and TikTok links. Clients book without creating an account. No marketplace listing next to your
              competitors.
            </p>
            <div className="mt-6">
              <ButtonLink href="/bellarose" variant="outline">
                See a live booking page
              </ButtonLink>
            </div>
          </div>
          <div className="card space-y-3 p-6">
            {["Cover banner and profile photo", "Services by category", "Gallery and client reviews", "Opening hours and sticky Book now"].map(
              (line) => (
                <div key={line} className="flex items-center gap-3 rounded-xl border border-edge bg-cream px-4 py-3 text-sm">
                  <Globe className="h-4 w-4 shrink-0 text-brand-400" />
                  {line}
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      {/* 7. Switching */}
      <section className="container-page py-12 lg:py-16">
        <div className="card p-8 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <Upload className="h-8 w-8 text-brand-400" />
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">
                Switch without starting over
              </h2>
              <p className="mt-4 leading-relaxed text-ink-soft">
                Import clients, services and appointments by CSV. Supports export formats from Square, Booksy, Timely
                and Fresha. Preview everything before it is saved.
              </p>
              <p className="mt-4 font-medium text-ink">Your data is yours, coming and going.</p>
              <p className="mt-2 text-sm text-ink-soft">
                Full GDPR account export any time from Settings. Leave whenever you want. No lock-in.
              </p>
            </div>
            <div className="space-y-3">
              {[
                "Step 1: Import services",
                "Step 2: Import clients",
                "Step 3: Import appointments",
                "Export guides for each platform in the dashboard",
              ].map((step) => (
                <div key={step} className="flex items-center gap-3 rounded-xl border border-edge bg-cream px-4 py-3 text-sm">
                  <FileDown className="h-4 w-4 shrink-0 text-brand-400" />
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 8. Comparison */}
      <section className="container-page py-12 lg:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Glow vs the big platforms
          </h2>
          <p className="mt-3 text-ink-soft">Honest comparison. UK pricing where we could verify it publicly.</p>
        </div>
        <ComparisonTable />
      </section>

      {/* 9. Pricing */}
      <section id="pricing" className="container-page py-12 lg:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Simple pricing
          </h2>
          <p className="mt-3 text-ink-soft">One price. Every feature. No commission on your clients.</p>
        </div>
        <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-2">
          <div className="card border-brand-500/40 p-6 sm:p-8">
            <p className="text-sm font-medium uppercase tracking-wider text-brand-text">Monthly</p>
            <p className="mt-2 font-display text-4xl font-semibold text-ink">
              £9.50 <span className="text-lg font-normal text-ink-faint">first month</span>
            </p>
            <p className="mt-1 text-ink-soft">then £19/mo. Cancel any time.</p>
            <ul className="mt-6 space-y-2 text-sm text-ink-soft">
              {["0% commission", "Deposits via Stripe Connect", "All features included"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-500" /> {t}
                </li>
              ))}
            </ul>
            <ButtonLink href="/signup" size="lg" className="mt-8 w-full">
              Start for £9.50
            </ButtonLink>
          </div>
          <div className="card p-6 sm:p-8">
            <p className="text-sm font-medium uppercase tracking-wider text-ink-faint">Annual</p>
            <p className="mt-2 font-display text-4xl font-semibold text-ink">
              £180 <span className="text-lg font-normal text-ink-faint">/year</span>
            </p>
            <p className="mt-1 text-ink-soft">Save about two months.</p>
            <ul className="mt-6 space-y-2 text-sm text-ink-soft">
              {["Same features as monthly", "Refer a tech, get a free month", "No contract"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-500" /> {t}
                </li>
              ))}
            </ul>
            <ButtonLink href="/signup" variant="outline" size="lg" className="mt-8 w-full">
              Sign up
            </ButtonLink>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-xl text-center text-sm text-ink-faint">
          Refer a tech with your personal signup link. When they become a paying member, you get a free month credited
          to your bill. Find your link in Billing after you sign up.
        </p>
      </section>

      {/* 10. FAQ */}
      <section className="container-page py-12 lg:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">Questions</h2>
        </div>
        <div className="mx-auto mt-8 max-w-2xl space-y-3">
          {FAQ.map((item) => (
            <details key={item.q} className="group card overflow-hidden">
              <summary className="cursor-pointer list-none px-5 py-4 font-medium text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  {item.q}
                  <span className="text-ink-faint transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <div className="border-t border-edge px-5 py-4 text-sm leading-relaxed text-ink-soft">{item.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* 11. Final CTA */}
      <section className="container-page py-12 pb-8 lg:py-16">
        <div className="card overflow-hidden bg-gradient-to-br from-brand-600 to-brand-800 p-8 text-center text-white sm:p-12">
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">
            Ready to run your diary properly?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/90 sm:text-lg">
            Set up in an evening. Share your link. Let deposits, patch tests and reminders do the boring work.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink
              href="/signup"
              size="lg"
              variant="outline"
              className="min-h-12 border-transparent bg-white font-semibold text-brand-900 shadow-lg hover:bg-neutral-50 hover:text-brand-950"
            >
              Start for £9.50
            </ButtonLink>
            <ButtonLink
              href="/bellarose"
              size="lg"
              variant="outline"
              className="min-h-12 border-white/40 bg-transparent text-white hover:bg-white/10"
            >
              See a live demo booking page
            </ButtonLink>
          </div>
          <p className="mt-6 text-sm text-white/75">
            <Link href="/login" className="underline hover:text-white">
              Already have an account? Log in
            </Link>
          </p>
        </div>
      </section>

      <footer className="container-page flex flex-col items-center justify-between gap-3 border-t border-edge py-8 text-sm text-ink-faint sm:flex-row">
        <p>© {new Date().getFullYear()} Glow. Made for UK beauty techs.</p>
        <nav className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/bellarose" className="hover:text-ink">
            Live demo
          </Link>
          <Link href="/signup" className="hover:text-ink">
            Sign up
          </Link>
          <Link href="/login" className="hover:text-ink">
            Log in
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <a href="mailto:support@glow-uk.com" className="hover:text-ink">
            Support
          </a>
        </nav>
      </footer>

      <StickyMobileCta />
    </div>
  );
}
