import Link from "next/link";
import { Lock, Sparkles, CheckCircle2, Clock } from "lucide-react";
import type { Tech } from "@/lib/db/types";

/**
 * Full-screen gate shown across the dashboard until a tech activates a plan.
 * New accounts must pay their first month (£9.50, or £1 for invited testers)
 * before they can use the booking tools. The owner and comped/active/trialing
 * accounts never see this - they're already "live".
 */
export function DashboardPaywall({ tech }: { tech: Tech }) {
  const isTester = tech.signupOffer === "tester";
  const price = isTester ? "£1" : "£9.50";

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

        <p className="mt-1">
          <span className="text-3xl font-semibold">{price}</span>
          <span className="text-ink-faint">
            {" "}
            first month, then £19/mo
          </span>
        </p>

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
          <Sparkles className="h-4 w-4" /> Go live for {price}
        </Link>
        <p className="text-xs text-ink-faint">
          0% commission, ever. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
