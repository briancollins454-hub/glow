import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { PageViewBeacon } from "@/components/analytics/page-view-beacon";
import { ButtonLink } from "@/components/ui/button";
import { JsonLd } from "@/components/seo/json-ld";
import { marketingMetadata } from "@/lib/marketing/types";
import { pricingFaqsForMode } from "@/lib/seo/config";
import { faqPageJsonLd } from "@/lib/seo/json-ld";
import { publicOfferCopy } from "@/lib/offers";
import { getSignupOfferMode } from "@/lib/platform-settings";
import { supabaseService } from "@/lib/supabase/service";

export const revalidate = 3600;

const page = {
  path: "/pricing",
  title: "Glow pricing — £19/mo everything included",
  description:
    "Glow costs £19 a month flat for UK lash, brow and nail techs. Unlimited staff, 0% commission, free migration. Offer at signup depends on the current launch mode.",
};

export const metadata: Metadata = marketingMetadata(page);

export default async function PricingPage() {
  const mode = await getSignupOfferMode(supabaseService());
  const offer = publicOfferCopy(mode);
  const faqs = pricingFaqsForMode(mode);
  return (
    <MarketingShell>
      <JsonLd data={faqPageJsonLd(faqs)} />
      <PageViewBeacon path="/pricing" />
      <article className="container-page pb-12 pt-4 lg:pb-16">
        <p className="text-sm text-ink-faint">
          <Link href="/" className="hover:text-ink">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-ink-soft">Pricing</span>
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl lg:text-[2.75rem]">
          Simple pricing. £19 a month. Everything included.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
          No per-staff fees. No marketplace commission. No bolt-ons. Your clients&apos; money goes
          straight into your own Stripe account.
        </p>

        <div className="mt-10 max-w-xl rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-500/15 to-transparent p-6 sm:p-8">
          <p className="text-sm font-medium text-brand-text">Monthly plan</p>
          <p className="mt-2 font-display text-4xl font-semibold text-ink">
            {offer.mode === "trial" ? (
              <>
                <span className="text-brand-text">Free</span>
                <span className="ml-2 text-lg font-medium text-ink-soft">for 14 days, then £19</span>
              </>
            ) : offer.firstMonthLabel === "£9.50" ? (
              <>
                <span className="text-brand-text">{offer.firstMonthLabel}</span>
                <span className="ml-2 text-lg font-medium text-ink-soft">first month, then £19</span>
              </>
            ) : (
              <>
                £19<span className="ml-2 text-lg font-medium text-ink-soft">per month</span>
              </>
            )}
          </p>
          <p className="mt-3 text-sm text-ink-soft">{offer.supporting}</p>
          <ButtonLink href="/signup" size="lg" className="mt-6 min-h-12">
            {offer.ctaLabel}
          </ButtonLink>
        </div>

        <section className="mt-14 max-w-3xl" aria-labelledby="pricing-faq-heading">
          <h2 id="pricing-faq-heading" className="font-display text-2xl font-semibold tracking-tight text-ink">
            Pricing FAQs
          </h2>
          <div className="mt-6 space-y-4">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-xl border border-edge bg-cream/40 px-4 py-3 open:bg-cream/70"
              >
                <summary className="cursor-pointer list-none font-medium text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                  {faq.question}
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </article>
    </MarketingShell>
  );
}
