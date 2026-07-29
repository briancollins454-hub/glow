"use client";

import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import type { PublicOfferCopy } from "@/lib/offers";

/** Fixed signup bar on phones so the main CTA is always one tap away. */
export function StickyMobileCta({ offer }: { offer: PublicOfferCopy }) {
  const shortCta =
    offer.mode === "half_price_first_month" && offer.firstMonthLabel === "£9.50"
      ? "Get started, £9.50"
      : offer.mode === "trial"
        ? "Try free for 14 days"
        : offer.ctaLabel;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-cream/95 px-4 py-3 pb-safe backdrop-blur-md lg:hidden">
      <div className="mx-auto flex max-w-lg gap-2">
        <ButtonLink href="/signup" size="lg" className="min-h-12 flex-1">
          {shortCta}
        </ButtonLink>
        <Link
          href="/ilashit"
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-edge bg-fill px-4 text-sm font-semibold text-ink transition hover:bg-fill-hover"
        >
          Lash studio
        </Link>
      </div>
    </div>
  );
}
