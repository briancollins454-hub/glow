import { requireOwner } from "@/lib/owner/require-owner";
import { ownerSb } from "@/lib/owner/require-owner";
import { getSignupOfferMode } from "@/lib/platform-settings";
import { OwnerNav } from "@/components/owner/owner-nav";
import { SubmitButton } from "@/components/ui/submit-button";
import { setSignupOfferModeAction } from "./offers-actions";
import { publicOfferCopy } from "@/lib/offers";

export const dynamic = "force-dynamic";

export default async function OwnerOffersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; mode?: string; err?: string }>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const mode = await getSignupOfferMode(ownerSb());
  const preview = publicOfferCopy(mode);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Signup offer</h1>
        <p className="text-sm text-ink-soft">
          Controls what new signups see and how Stripe Checkout behaves. Existing accounts keep the
          offer frozen on their tech record — changing this never rewrites them.
        </p>
      </div>
      <OwnerNav />

      {sp.err === "confirm" ? (
        <p className="rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-warning-text">
          Type <strong>yes</strong> to confirm before changing the live offer mode.
        </p>
      ) : null}
      {sp.ok ? (
        <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">
          Signup offer mode is now <strong>{sp.mode ?? mode}</strong>.
        </p>
      ) : null}

      <div className="rounded-xl border border-edge bg-surface p-5 space-y-4">
        <p className="text-sm">
          Current mode: <strong className="font-medium">{mode}</strong>
        </p>
        <p className="text-sm text-ink-soft">
          Preview CTA: <em>{preview.ctaLabel}</em>
        </p>
        <p className="text-xs text-ink-faint">{preview.supporting}</p>

        <form action={setSignupOfferModeAction} className="space-y-3 border-t border-edge pt-4">
          <label className="block text-sm font-medium">
            New mode
            <select
              name="mode"
              defaultValue={mode}
              className="mt-1 block w-full max-w-md rounded-xl border border-edge bg-cream px-3 py-2 text-sm"
            >
              <option value="half_price_first_month">Half-price first month (£9.50 then £19)</option>
              <option value="trial">14-day free trial (card captured, charge on day 14)</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Type yes to confirm
            <input
              name="confirm"
              autoComplete="off"
              className="mt-1 block w-full max-w-xs rounded-xl border border-edge bg-cream px-3 py-2 text-sm"
              placeholder="yes"
            />
          </label>
          <SubmitButton pendingLabel="Saving…">Save offer mode</SubmitButton>
        </form>
      </div>
    </div>
  );
}
