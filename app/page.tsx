import Link from "next/link";
import {
  CalendarHeart,
  ShieldCheck,
  Sparkles,
  Clock,
  BellRing,
  Receipt,
  HeartHandshake,
  Instagram,
  CheckCircle2,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

const features = [
  {
    icon: ShieldCheck,
    title: "Deposits & no-show protection",
    body: "Take a deposit on every booking and set your own cancellation window. No-shows are flagged automatically.",
  },
  {
    icon: Sparkles,
    title: "Patch test tracking",
    body: "Services that need a patch test simply can't be booked without a valid one on file. Stay insured, stay safe.",
  },
  {
    icon: Clock,
    title: "Infill timing rules",
    body: "Lash, nail and brow infills only show for clients within your rebooking window. Everyone else books a full set.",
  },
  {
    icon: BellRing,
    title: "Automatic reminders",
    body: "Confirmation, 24-hour and balance-due reminders go out on their own. Fewer gaps, fewer no-shows.",
  },
  {
    icon: Receipt,
    title: "Pay remaining balance",
    body: "Clients settle the balance from a private link before they arrive. Less awkward card-tapping at the chair.",
  },
  {
    icon: HeartHandshake,
    title: "Client notes & blacklist",
    body: "Warning notes and a blacklist keep difficult clients from slipping back into your calendar.",
  },
];

const COMPARISON = [
  { label: "Commission on your bookings", glow: "0%, ever", others: "Up to 35% on new clients" },
  { label: "Your clients shown competitors", glow: "Never - it's your page", others: "Marketplace promotes nearby rivals" },
  { label: "Deposits & no-show protection", glow: "Built in", others: "Often paid add-ons" },
  { label: "Patch tests & infill timing rules", glow: "Built for beauty techs", others: "Generic salon tools" },
  { label: "Price", glow: "£19/mo flat, cancel anytime", others: "Subscriptions + fees + upsells" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <header className="container-page flex items-center justify-between py-6">
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
          <ButtonLink href="/signup" size="sm">
            Start free
          </ButtonLink>
        </nav>
      </header>

      <section className="container-page grid items-center gap-12 py-12 lg:grid-cols-2 lg:py-20">
        <div className="animate-fade-in">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-sm font-medium text-brand-300">
            <Sparkles className="h-4 w-4" /> Built for beauty techs
          </span>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-6xl">
            Your booking page, your rules.{" "}
            <span className="bg-gradient-to-r from-brand-400 via-brand-500 to-fuchsia-400 bg-clip-text text-transparent">
              No hidden fees.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-soft">
            Glow is the booking system made for self-employed lash, nail and brow
            techs. Deposits, patch tests, infill timing and reminders
            built in - without a marketplace taking a cut of your clients.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/signup" size="lg">
              Create your booking page
            </ButtonLink>
            <ButtonLink href="/bellarose" variant="outline" size="lg">
              View a live example
            </ButtonLink>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
            {[
              "0% commission",
              "Share on Instagram & TikTok",
              "Cancel anytime",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-brand-500" /> {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="animate-fade-in relative">
          <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-brand-600/20 blur-3xl" />
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white">
              <p className="text-sm/relaxed opacity-90">glow.app/</p>
              <p className="font-display text-2xl font-semibold">bellarose</p>
              <p className="mt-1 text-sm opacity-90">
                Bella Rose Beauty · Manchester
              </p>
            </div>
            <div className="space-y-3 p-6">
              {[
                { name: "Classic Full Set", meta: "2h · £55 · £16.50 deposit" },
                { name: "Classic Infill", meta: "1h 15m · £35 · returning only" },
                { name: "Brow Lamination", meta: "1h · £40 · patch test required" },
              ].map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between rounded-xl border border-edge bg-cream px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-ink">{s.name}</p>
                    <p className="text-xs text-ink-faint">{s.meta}</p>
                  </div>
                  <span className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white">
                    Book
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1 text-xs text-ink-faint">
                <Instagram className="h-4 w-4" /> Linked from your bio
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-12 lg:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold">
            Everything a beauty tech actually needs
          </h2>
          <p className="mt-3 text-ink-soft">
            The big platforms bolt this on or charge extra. Here it is the whole
            point.
          </p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/15 text-brand-300">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-ink-soft">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-12 lg:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold">Why techs switch to Glow</h2>
          <p className="mt-3 text-ink-soft">No commission. No marketplace poaching your clients. One flat price.</p>
        </div>
        {/* Tablet/desktop: side-by-side table */}
        <div className="card mt-10 hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge text-left text-ink-faint">
                <th className="p-4 font-medium"></th>
                <th className="p-4 font-semibold text-brand-300">Glow</th>
                <th className="p-4 font-medium">Marketplace apps</th>
              </tr>
            </thead>
            <tbody className="[&_td]:p-4 [&_tr]:border-b [&_tr]:border-edge">
              {COMPARISON.map((row, i) => (
                <tr key={row.label} className={i === COMPARISON.length - 1 ? "!border-b-0" : ""}>
                  <td className="text-ink-soft">{row.label}</td>
                  <td className="font-semibold text-emerald-300">{row.glow}</td>
                  <td className="text-ink-soft">{row.others}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Phones: stacked cards, nothing to scroll sideways */}
        <div className="mt-10 space-y-3 sm:hidden">
          {COMPARISON.map((row) => (
            <div key={row.label} className="card p-4">
              <p className="text-sm font-medium text-ink">{row.label}</p>
              <div className="mt-2.5 space-y-1.5 text-sm">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="shrink-0 font-semibold text-brand-300">Glow</span>
                  <span className="text-right font-semibold text-emerald-300">{row.glow}</span>
                </p>
                <p className="flex items-baseline justify-between gap-3">
                  <span className="shrink-0 text-ink-faint">Marketplace apps</span>
                  <span className="text-right text-ink-soft">{row.others}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-6 lg:py-10">
        <div className="card mx-auto max-w-2xl p-8 text-center">
          <p className="font-display text-xl font-medium leading-relaxed">
            &ldquo;Deposits, reminders and my own booking link in one place - and my clients stay mine.
            I set it up in an evening.&rdquo;
          </p>
          <p className="mt-4 text-sm text-ink-faint">Claudia · ILashIt, lash tech</p>
        </div>
      </section>

      <section className="container-page py-12">
        <div className="card overflow-hidden bg-gradient-to-br from-brand-600 to-brand-800 p-10 text-center text-white">
          <h2 className="font-display text-3xl font-semibold">
            Ready to fill your calendar?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">
            Set up your services, share your link, and let deposits and reminders
            do the chasing for you.
          </p>
          <div className="mt-7 flex justify-center gap-3">
            <ButtonLink
              href="/signup"
              size="lg"
              className="bg-none bg-white text-brand-700 shadow-none hover:bg-white/90"
            >
              Get started free
            </ButtonLink>
            <ButtonLink
              href="/login"
              size="lg"
              variant="outline"
              className="border-white/40 bg-transparent text-white hover:bg-white/10"
            >
              Log in
            </ButtonLink>
          </div>
        </div>
      </section>

      <footer className="container-page flex flex-col items-center justify-between gap-3 border-t border-edge py-8 text-sm text-ink-faint sm:flex-row">
        <p>© {new Date().getFullYear()} Glow. Made for beauty techs.</p>
        <nav className="flex items-center gap-4">
          <Link href="/bellarose" className="hover:text-ink">Live demo</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <a href="mailto:support@glow-uk.com" className="hover:text-ink">Support</a>
        </nav>
      </footer>
    </div>
  );
}
