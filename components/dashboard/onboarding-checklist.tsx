import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, PartyPopper } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";

export interface SetupStep {
  title: string;
  detail: string;
  href: string;
  done: boolean;
  cta: string;
}

/**
 * The "you can't get lost" setup guide. Ticks itself off automatically and
 * disappears once the tech is fully set up.
 */
export function OnboardingChecklist({
  steps,
  bookingUrl,
}: {
  steps: SetupStep[];
  bookingUrl: string;
}) {
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const next = steps.find((s) => !s.done);

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-edge bg-brand-500/10 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-lg font-semibold">
            {allDone ? (
              <span className="flex items-center gap-2"><PartyPopper className="h-5 w-5 text-brand-400" /> You&apos;re all set - share your link!</span>
            ) : (
              "Let's get you taking bookings"
            )}
          </p>
          <span className="text-sm font-medium text-brand-text">{doneCount} of {steps.length} done</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-fill-hover">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all"
            style={{ width: `${Math.max(6, (doneCount / steps.length) * 100)}%` }}
          />
        </div>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {steps.map((step) => (
          <div key={step.title} className={`flex items-center gap-3 px-5 py-3.5 ${step.done ? "opacity-60" : ""}`}>
            {step.done ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            ) : (
              <Circle className={`h-5 w-5 shrink-0 ${step === next ? "text-brand-400" : "text-ink-faint"}`} />
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${step.done ? "line-through" : ""}`}>{step.title}</p>
              {!step.done && <p className="text-xs text-ink-faint">{step.detail}</p>}
            </div>
            {!step.done && (
              <Link
                href={step.href}
                className={`inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  step === next
                    ? "bg-brand-600 text-white hover:bg-brand-700"
                    : "text-brand-400 hover:bg-fill-hover"
                }`}
              >
                {step.cta} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-medium">Share your booking link</p>
            <p className="truncate text-xs text-ink-faint">{bookingUrl.replace(/^https?:\/\//, "")} - pop it in your Instagram &amp; TikTok bio</p>
          </div>
          <CopyButton text={bookingUrl} />
        </div>
      </div>
    </div>
  );
}
