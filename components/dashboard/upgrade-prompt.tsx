import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";

/** Shown in place of a paid feature when the tech isn't on an active plan/trial. */
export function UpgradePrompt({ feature }: { feature: string }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-400">
        <Lock className="h-6 w-6" />
      </span>
      <h2 className="font-display text-xl font-semibold">{feature} is a plan feature</h2>
      <p className="max-w-sm text-sm text-ink-soft">
        Subscribe to unlock {feature.toLowerCase()} and take live bookings - 50% off your first month. Cancel anytime, no commission ever.
      </p>
      <Link
        href="/dashboard/billing"
        className="mt-1 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        <Sparkles className="h-4 w-4" /> See plans
      </Link>
    </div>
  );
}
