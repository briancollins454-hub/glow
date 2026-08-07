import Link from "next/link";
import { Lock, Sparkles, CheckCircle2, Clock } from "lucide-react";
import type { Tech } from "@/lib/db/types";
import { frozenOfferCopy } from "@/lib/offers";

/**
 * Full-screen gate shown across the dashboard until a tech activates a plan.
 * Copy follows the offer frozen on the tech at signup (trial / half-price).
 */
export function DashboardPaywall({ tech }: { tech: Tech }) {
  const offer = frozenOfferCopy({
    signupOffer: tech.signupOffer,
    signupPartnerSlug: tech.signupPartnerSlug,
  });
  const isTrial = tech.signupOffer === "trial";

  return (
    <div className="mx-auto max-w-lg">
      <div className="card flex flex-col items-center gap-4 px-6 py-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-500/10 text-brand-400">
          <Lock className="h-7 w-7" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold">
            Activate your booking page
          </h1>
          <p className="mt-2 max-w-sm text-sm text-ink-soft">
            Your account is created, but you&apos;ll need to start your plan
            before you can set up services, take bookings or message clients.
          </p>
        </div>

        {isTrial ? (
          <p className="mt-1 max-w-sm text-sm text-ink-soft">{offer.supporting}</p>
        ) : (
          <p className="mt-1">
            <span className="text-3xl font-semibold">{offer.firstMonthLabel}</span>
            <span className="text-ink-faint"> first month, then £19/mo</span>
          </p>
        )}

        <ul className="space-y-2 text-left text-sm text-ink-soft">
          <li className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-500" /> Branded booking page
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-brand-500" /> Deposits &amp; no-show
            protection
          </li>
          <li className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-brand-500" /> Reminders &amp; client
            messaging
          </li>
        </ul>

        <Link
          href="/dashboard/billing"
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          <Sparkles className="h-4 w-4" /> {offer.ctaLabel}
        </Link>
        <p className="text-xs text-ink-faint">
          0% commission, ever. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
