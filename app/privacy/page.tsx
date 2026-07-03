import Link from "next/link";
import { CalendarHeart } from "lucide-react";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-cream px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="mb-8 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
            <CalendarHeart className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-semibold">Glow</span>
        </Link>

        <h1 className="font-display text-3xl font-semibold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-ink-faint">Last updated: 3 July 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-soft">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">What this covers</h2>
            <p>
              This policy explains how Glow (glow-uk.com) handles personal data. It covers two
              groups: <strong className="text-ink">beauty techs</strong> who subscribe to Glow, and{" "}
              <strong className="text-ink">their clients</strong> who book appointments through a
              tech&apos;s booking page.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">If you are a beauty tech</h2>
            <p>We collect and store:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Account details: name, email, password (stored securely, never in plain text)</li>
              <li>Business details: business name, handle, bio, location, social handles, branding</li>
              <li>Billing details: handled by Stripe; we store only references, never card numbers</li>
              <li>Usage data needed to run the service (bookings, reminders sent, messages)</li>
            </ul>
            <p className="mt-2">
              We use this to provide the service, bill you, and send you service emails. We do
              not sell your data or send marketing on behalf of third parties.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">If you are a client booking with a tech</h2>
            <p>
              When you book, message or pay, we process the details you provide (name, email,
              phone, consultation answers, booking history, photos your tech uploads with your
              consent) on behalf of your beauty tech. Your tech is the data controller; Glow is
              their processor. Questions about how your information is used should go first to
              your tech. Payments are processed by Stripe; Glow never sees your card number.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">Who we share data with</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong className="text-ink">Stripe</strong> - payments and subscriptions</li>
              <li><strong className="text-ink">Supabase</strong> - database and file storage (EU region)</li>
              <li><strong className="text-ink">Resend</strong> - transactional email delivery (EU region)</li>
              <li><strong className="text-ink">Vercel</strong> - website hosting</li>
            </ul>
            <p className="mt-2">
              Each provider processes data under their own security and data-processing terms.
              We never sell personal data.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">How long we keep data</h2>
            <p>
              For as long as the tech&apos;s account is active, so their client history works as
              expected. When an account closes, data is deleted or anonymised within a
              reasonable period, except records we must keep by law (e.g. billing records).
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">Your rights</h2>
            <p>
              Under UK GDPR you can ask for access to, correction of, or deletion of your
              personal data, and you can complain to the ICO (ico.org.uk). Clients should
              contact their tech first; techs can contact us directly.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">Cookies</h2>
            <p>
              We use only essential cookies: keeping techs logged in. No advertising or
              cross-site tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">Contact</h2>
            <p>
              Privacy questions:{" "}
              <a href="mailto:support@glow-uk.com" className="text-brand-400">support@glow-uk.com</a>
            </p>
          </section>
        </div>

        <p className="mt-10 text-xs text-ink-faint">
          <Link href="/" className="text-brand-400">Home</Link> · <Link href="/terms" className="text-brand-400">Terms of Service</Link>
        </p>
      </div>
    </div>
  );
}
