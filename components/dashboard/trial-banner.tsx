import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import type { Tech } from "@/lib/db/types";
import { fmtDate } from "@/lib/format";
import { MONTHLY_PRICE_LABEL } from "@/lib/offers";
import { trialDaysRemaining, isOnFrozenTrial } from "@/lib/trial-lifecycle";

/** Banner while a frozen trial is active: days left + first charge date/amount. */
export function TrialBanner({ tech }: { tech: Tech }) {
  if (!isOnFrozenTrial(tech) || tech.subscriptionStatus !== "trialing") return null;
  const days = trialDaysRemaining(tech.trialEndsAt);
  const ends = tech.trialEndsAt ? fmtDate(tech.trialEndsAt) : "the end of your trial";
  return (
    <div className="border-b border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm text-brand-text">
      <div className="container-page flex flex-wrap items-center gap-2">
        <Clock className="h-4 w-4 shrink-0" />
        <p className="min-w-0 flex-1">
          <strong>
            {days === 0 ? "Trial ends today" : days === 1 ? "1 day left on your trial" : `${days} days left on your trial`}
          </strong>
          {" — "}
          your card will be charged <strong>{MONTHLY_PRICE_LABEL}</strong> on <strong>{ends}</strong>. Cancel any
          time before then and you won&apos;t be charged.
        </p>
        <Link href="/dashboard/billing" className="shrink-0 font-medium underline underline-offset-2">
          Manage billing
        </Link>
      </div>
    </div>
  );
}

/** Banner when subscription is past_due (dunning / failed first charge). */
export function PastDueBanner({ tech }: { tech: Tech }) {
  if (tech.subscriptionStatus !== "past_due") return null;
  return (
    <div className="border-b border-amber-500/40 bg-amber-500/15 px-4 py-3 text-sm text-warning-text">
      <div className="container-page flex flex-wrap items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <p className="min-w-0 flex-1">
          <strong>Payment past due.</strong> Update your card so your booking page stays online. We&apos;ll retry
          automatically; we&apos;ll email you before taking the page offline.
        </p>
        <Link href="/dashboard/billing" className="shrink-0 font-medium underline underline-offset-2">
          Update card
        </Link>
      </div>
    </div>
  );
}
