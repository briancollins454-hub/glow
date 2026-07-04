import Link from "next/link";
import { CalendarHeart } from "lucide-react";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-cream px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="mb-8 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
            <CalendarHeart className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-semibold">Glow</span>
        </Link>

        <h1 className="font-display text-3xl font-semibold">Terms of Service</h1>
        <p className="mt-2 text-sm text-ink-faint">Last updated: 3 July 2026</p>

        <div className="prose-invert mt-8 space-y-6 text-sm leading-relaxed text-ink-soft">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">1. Who we are</h2>
            <p>
              Glow (&quot;we&quot;, &quot;us&quot;) provides an online booking platform for self-employed
              beauty professionals (&quot;you&quot;, the &quot;tech&quot;), available at glow-uk.com.
              These terms apply to your use of Glow as a business subscriber.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">2. Your account</h2>
            <p>
              You must provide accurate information when signing up and keep your login details
              secure. You are responsible for activity on your account. You must be at least 18
              and using Glow for a genuine business.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">3. Subscriptions and fees</h2>
            <p>
              Glow is offered on a subscription basis (monthly or annual) with any introductory
              offer as described at checkout. We take no commission on your bookings. Client
              payments (deposits and balances) go directly to your own Stripe account; Stripe&apos;s
              own card processing fees apply and are set by Stripe, not us. You can cancel your
              subscription at any time from Billing; access continues until the end of the paid
              period. Fees already paid are non-refundable except where required by law.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">4. Your clients and your data</h2>
            <p>
              You own your client list and booking data. We process it only to run the service
              for you (see our <Link href="/privacy" className="text-brand-400">Privacy Policy</Link>).
              For your clients&apos; personal data, you are the data controller and we are your
              processor. You are responsible for having a lawful basis to store your clients&apos;
              details and for the accuracy of notes you keep about them.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">5. Acceptable use</h2>
            <p>
              Don&apos;t use Glow for anything unlawful, to send spam, to store content you have no
              right to store, or to harass anyone. Patch-test and treatment-suitability decisions
              are yours alone: Glow&apos;s reminders and rules are tools, not professional, medical
              or insurance advice.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">6. Payments between you and your clients</h2>
            <p>
              Deposits, cancellation windows and no-show fees are policies you set and are a
              matter between you and your client. We provide the tooling to apply them
              consistently. Refunds to clients are your responsibility, though the platform
              automates them in the situations described in the product.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">7. Availability and changes</h2>
            <p>
              We aim for high availability but do not guarantee uninterrupted service. We may
              improve or change features over time. If we ever discontinue Glow, we will give
              you at least 30 days&apos; notice and a way to export your data.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">8. Liability</h2>
            <p>
              Glow is provided &quot;as is&quot;. To the maximum extent permitted by law, our total
              liability to you in any 12-month period is limited to the subscription fees you
              paid us in that period. Nothing in these terms limits liability that cannot be
              limited under UK law.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">9. Ending your account</h2>
            <p>
              You can close your account at any time. We may suspend or close accounts that
              breach these terms. On closure we delete or anonymise your data within a
              reasonable period, except records we must keep by law.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">10. Contact</h2>
            <p>
              Questions about these terms: email{" "}
              <a href="mailto:support@glow-uk.com" className="text-brand-400">support@glow-uk.com</a>.
              These terms are governed by the laws of England and Wales.
            </p>
          </section>
        </div>

        <p className="mt-10 text-xs text-ink-faint">
          <Link href="/" className="text-brand-400">Home</Link> · <Link href="/privacy" className="text-brand-400">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
