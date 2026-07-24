import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarHeart } from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { PageViewBeacon } from "@/components/analytics/page-view-beacon";
import { ButtonLink } from "@/components/ui/button";
import { getPartnerBySlug } from "@/lib/partners";
import { partnerOfferEnabled } from "@/lib/offers";
import { marketingMetadata } from "@/lib/marketing/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const partner = await getPartnerBySlug(slug).catch(() => null);
  if (!partner) {
    return { title: "Partner offer", robots: { index: false, follow: false } };
  }
  return marketingMetadata({
    path: `/partner/${partner.slug}`,
    title: `${partner.name} students get 3 months of Glow free`,
    description: `Exclusive Glow booking offer for ${partner.name} students. 3 months free, then £19/mo. 0% commission.`,
  });
}

export default async function PartnerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!partnerOfferEnabled()) notFound();
  const { slug } = await params;
  const partner = await getPartnerBySlug(slug).catch(() => null);
  if (!partner) notFound();

  return (
    <MarketingShell partnerSlug={partner.slug}>
      <PageViewBeacon path={`/partner/${partner.slug}`} />
      <section className="container-page py-12 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          {partner.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={partner.logoUrl}
              alt={partner.name}
              className="mx-auto mb-6 h-16 w-auto max-w-[220px] object-contain"
            />
          ) : (
            <span className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow">
              <CalendarHeart className="h-7 w-7" />
            </span>
          )}
          <p className="text-sm font-medium uppercase tracking-wider text-brand-text">
            Partner offer
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl lg:text-[2.75rem]">
            {partner.name} students get 3 months of Glow free
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-ink-soft">
            The booking platform built for lash, brow and nail techs. £19 a month after your free period,
            everything included, 0% commission.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href={`/signup?partner=${encodeURIComponent(partner.slug)}`} size="lg" className="min-h-12">
              Get started with your academy offer
            </ButtonLink>
            <ButtonLink href="/bellarose" variant="outline" size="lg" className="min-h-12">
              Lash studio
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-ink-faint">
            Then £19/mo. Cancel anytime.{" "}
            <Link href="/" className="underline underline-offset-2 hover:text-ink">
              Learn more about Glow
            </Link>
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
