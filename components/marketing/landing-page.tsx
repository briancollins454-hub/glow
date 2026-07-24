import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarHeart,
  CheckCircle2,
  Gift,
  Sparkles,
  Upload,
  Wallet,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { StickyMobileCta } from "@/components/marketing/sticky-mobile-cta";
import { PageViewBeacon } from "@/components/analytics/page-view-beacon";
import { COMPARE_LINKS, SWITCH_LINKS, GUIDE_LINKS } from "@/lib/marketing/types";
import { launchOfferCopy, launchOfferEnabled } from "@/lib/offers";
import { AttributionCapture } from "@/components/marketing/attribution-capture";

export const revalidate = 3600;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://glow-uk.com";
const APP_HOST = APP_URL.replace(/^https?:\/\//, "");
const offer = launchOfferCopy(false);

const META_DESCRIPTION =
  "The booking platform built for lash, brow and nail techs. £19 a month, everything included, 0% commission. Made by a working lash tech.";

export const metadata: Metadata = {
  title: "Booking platform for lash, brow and nail techs UK",
  description: META_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "Glow",
    url: APP_URL,
    title: "Booking platform for lash, brow and nail techs UK | Glow",
    description: META_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Booking platform for lash, brow and nail techs UK | Glow",
    description: META_DESCRIPTION,
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <AttributionCapture />
      <PageViewBeacon path="/" />
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

      <section className="container-page grid items-center gap-10 py-10 lg:grid-cols-2 lg:gap-12 lg:py-16">
        <div className="animate-fade-in">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-sm font-medium text-brand-text">
            <Sparkles className="h-4 w-4" /> Lash, brow and nail
          </span>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[3.25rem]">
            The booking platform built for lash, brow and nail techs.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
            Made by a working lash tech and the developer she lives with. £19 a month, everything included, 0%
            commission, and your money goes straight into your own bank.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink href="/signup" size="lg" className="min-h-12">
              {offer.ctaLabel}
            </ButtonLink>
            <ButtonLink href="#included" variant="outline" size="lg" className="min-h-12">
              See everything that&apos;s included
            </ButtonLink>
          </div>
          <p className="mt-3 text-sm text-ink-faint">{offer.trustLine}</p>
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
                { name: "Classic Full Set", meta: "2h · £55 · patch test gated" },
                { name: "Classic Infill", meta: "Returning clients · within 21 days" },
                { name: "Brow Lamination", meta: "Consent + aftercare automatic" },
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

      <section className="container-page py-12 lg:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Built for how you actually work
          </h2>
          <p className="mt-3 text-ink-soft">Generic salon software treats a lash fill like a haircut. Glow doesn&apos;t.</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {[
            {
              title: "Patch tests, handled.",
              body: "Book them, track them, and Glow won't let a client book a treatment that needs one they haven't had.",
            },
            {
              title: "Infills that make sense.",
              body: "Infill windows, express options and full set logic built in, not bodged with duplicate services.",
            },
            {
              title: "Consent and aftercare, automatic.",
              body: "Consultation forms before the visit, aftercare messages after it, without you lifting a finger.",
            },
            {
              title: "Deposits and card on file.",
              body: "No-shows pay or they don't book. Your cancellation policy, actually enforced.",
            },
          ].map((item) => (
            <div key={item.title} className="card p-6">
              <h3 className="text-lg font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-12 lg:py-16">
        <div className="card border-brand-500/25 bg-gradient-to-br from-brand-500/10 to-transparent p-8 sm:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <Wallet className="mx-auto h-8 w-8 text-brand-400" />
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Your money is your money
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-soft sm:text-lg">
              When a client pays a deposit, it lands in <strong className="text-ink">your</strong> Stripe account. Not
              ours. Not held for a week. Not minus a commission. Glow never touches your money, and we never will.
            </p>
            <p className="mt-4 text-base font-medium leading-relaxed text-ink sm:text-lg">
              0% commission. Forever. It&apos;s not a promotional rate, it&apos;s the architecture.
            </p>
          </div>
        </div>
      </section>

      <section id="included" className="container-page py-12 lg:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Everything included means everything
          </h2>
          <p className="mt-3 text-ink-soft">
            Other platforms sell half of this list as add-ons. On Glow it&apos;s just the product. £19. That&apos;s the
            pricing page.
          </p>
        </div>
        <ul className="mx-auto mt-8 grid max-w-4xl gap-2 sm:grid-cols-2">
          {[
            "Unlimited staff",
            "Unlimited bookings",
            "Deposits and card on file",
            "Text and email reminders",
            "Waitlists",
            "Gift vouchers",
            "Loyalty rewards",
            "Client reviews",
            "Multi-location",
            "Your own booking page",
            "Client self-service",
            "Reports",
            "Cancellation notifications",
          ].map((item) => (
            <li
              key={item}
              className="flex items-center gap-2.5 rounded-xl border border-edge bg-cream/60 px-4 py-3 text-sm text-ink-soft"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-500" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="container-page py-12 lg:py-16">
        <div className="card p-8 sm:p-10">
          <Upload className="h-8 w-8 text-brand-400" />
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">
            Moving is our job, not yours
          </h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-ink-soft">
            Switching from Fresha, Booksy, Treatwell or anywhere else? Send us whatever export your current system gives
            you and we&apos;ll clean it, map it and load it. Your clients, your bookings, your services, moved for free.
            Most techs are live within a day.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/signup">Move to Glow free</ButtonLink>
            <ButtonLink href="/switch/fresha" variant="outline">
              Switch from Fresha
            </ButtonLink>
            <ButtonLink href="/switch/booksy" variant="outline">
              Switch from Booksy
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="container-page py-12 lg:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Built by people who do the job
          </h2>
          <p className="mt-4 text-ink-soft leading-relaxed">
            Glow was built by Klaudia, a working lash and brow tech, and Brian, the developer she lives with. Every
            feature exists because a real tech needed it. When our customers ask for something, it usually ships the same
            day. Ask them.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <ButtonLink href="/customers/klaudia" variant="outline">
              Lash studio
            </ButtonLink>
            <ButtonLink href="/customers/claire" variant="outline">
              Brow bar
            </ButtonLink>
            <ButtonLink href="/bellarose" variant="outline">
              Nail studio
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="container-page py-12 lg:py-16">
        <div className="card border-brand-500/30 bg-gradient-to-br from-brand-500/10 to-transparent p-8 sm:p-10">
          <Gift className="h-8 w-8 text-brand-400" />
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">
            Refer a tech, get a month free
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">
            Every tech you refer gets Glow, you get a free month credited to your account. No limits. Some of our
            customers haven&apos;t paid a bill in months.
          </p>
          <p className="mt-3 text-sm text-ink-faint">
            Your personal referral link lives in Billing after signup. Launch coupon applies to invoice 1; referral
            credits land from invoice 2 onward.
          </p>
        </div>
      </section>

      <section className="container-page py-12 pb-8 lg:py-16">
        <div className="card overflow-hidden bg-gradient-to-br from-brand-600 to-brand-800 p-8 text-center text-white sm:p-12">
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">
            {launchOfferEnabled()
              ? "First month half price. Everything included. £9.50, then £19."
              : "Everything included. £19 a month."}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/90 sm:text-lg">
            Set up in minutes. Free migration. Cancel anytime.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink
              href="/signup"
              size="lg"
              variant="outline"
              className="min-h-12 border-transparent bg-white font-semibold text-brand-900 shadow-lg hover:bg-neutral-50 hover:text-brand-950"
            >
              Start now
            </ButtonLink>
          </div>
        </div>
      </section>

      <footer className="container-page border-t border-edge py-10 text-sm text-ink-faint">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-medium text-ink">Glow</p>
            <p className="mt-2">© {new Date().getFullYear()} Glow. Made for UK beauty techs.</p>
            <div className="mt-3 flex flex-wrap gap-3">
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
            </div>
          </div>
          <div>
            <p className="font-medium text-ink">Compare</p>
            <ul className="mt-2 space-y-1.5">
              {COMPARE_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-ink">Switching</p>
            <ul className="mt-2 space-y-1.5">
              {SWITCH_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-ink">Guides</p>
            <ul className="mt-2 space-y-1.5">
              {GUIDE_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <a href="mailto:support@glow-uk.com" className="hover:text-ink">
                  Support
                </a>
              </li>
            </ul>
          </div>
        </div>
      </footer>

      <StickyMobileCta />
    </div>
  );
}
