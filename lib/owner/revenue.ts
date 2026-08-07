import type Stripe from "stripe";
import { supabaseService } from "@/lib/supabase/service";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { computeMrrFromTechs, planMrrPennies, type MrrBreakdown } from "@/lib/owner/mrr";
import type { Tech } from "@/lib/db/types";

export type SubscriptionRow = {
  tech: Pick<
    Tech,
    | "id"
    | "businessName"
    | "handle"
    | "email"
    | "plan"
    | "subscriptionStatus"
    | "signupOffer"
    | "currentPeriodEnd"
    | "stripeSubscriptionId"
    | "stripeCustomerId"
    | "createdAt"
  >;
  mrrPennies: number;
  stripeStatus: string | null;
  stripeAmountPennies: number | null;
  mismatch: string | null;
};

export type RevenueSnapshot = {
  mrr: MrrBreakdown;
  rows: SubscriptionRow[];
  pastDue: SubscriptionRow[];
  stripeConfigured: boolean;
  stripeReconcileNote: string;
  promoNote: string;
  generatedAt: string;
};

function mapStripeStatus(s: string): string {
  return s;
}

/**
 * Glow subscription revenue view. Client Connect GMV is never included here.
 */
export async function getRevenueSnapshot(opts?: { reconcileStripe?: boolean }): Promise<RevenueSnapshot> {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("techs")
    .select(
      "id, businessName, handle, email, plan, subscriptionStatus, signupOffer, currentPeriodEnd, stripeSubscriptionId, stripeCustomerId, createdAt, isInternal",
    )
    .order("createdAt", { ascending: false });
  if (error) throw new Error(error.message);
  const { filterOutInternal, shouldIncludeInternal } = await import("@/lib/owner/internal-accounts");
  const includeInternal = await shouldIncludeInternal(sb);
  const techs = filterOutInternal((data ?? []) as Tech[], includeInternal);
  const mrr = computeMrrFromTechs(techs);

  const rows: SubscriptionRow[] = techs.map((tech) => ({
    tech,
    mrrPennies: tech.subscriptionStatus === "active" ? planMrrPennies(tech.plan) : 0,
    stripeStatus: null,
    stripeAmountPennies: null,
    mismatch: null,
  }));

  let stripeReconcileNote =
    "Stripe reconcile off for this load. Use Refresh from Stripe to compare live subscription status and amounts.";
  const canStripe = stripeConfigured() && opts?.reconcileStripe;

  if (canStripe) {
    const s = stripe();
    let checked = 0;
    let mismatches = 0;
    // Only reconcile accounts that look billed (have a subscription id).
    for (const row of rows) {
      const subId = row.tech.stripeSubscriptionId;
      if (!subId) continue;
      try {
        const sub = (await s.subscriptions.retrieve(subId)) as Stripe.Subscription;
        checked++;
        const item = sub.items.data[0];
        const amount = item?.price?.unit_amount ?? null;
        row.stripeStatus = mapStripeStatus(sub.status);
        row.stripeAmountPennies = amount;
        const glowActive = row.tech.subscriptionStatus === "active";
        const stripeActive = sub.status === "active";
        if (glowActive !== stripeActive) {
          row.mismatch = `Glow=${row.tech.subscriptionStatus}, Stripe=${sub.status}`;
          mismatches++;
        } else if (
          glowActive &&
          amount != null &&
          row.mrrPennies > 0 &&
          // Annual Stripe amount is yearly; compare monthly list carefully.
          row.tech.plan === "monthly" &&
          amount !== 1900
        ) {
          // Soft flag only when list monthly amount differs and not obviously intro.
          if (amount !== row.mrrPennies) {
            row.mismatch = `Amount Stripe=${amount}p vs Glow list MRR=${row.mrrPennies}p`;
            mismatches++;
          }
        }
      } catch (e) {
        row.mismatch = `Stripe fetch failed: ${(e as Error).message}`;
        mismatches++;
      }
    }
    stripeReconcileNote = `Checked ${checked} Stripe subscription(s); ${mismatches} mismatch(es).`;
  } else if (!stripeConfigured()) {
    stripeReconcileNote = "Stripe is not configured in this environment — reconcile unavailable.";
  }

  return {
    mrr,
    rows,
    pastDue: rows.filter((r) => r.tech.subscriptionStatus === "past_due"),
    stripeConfigured: stripeConfigured(),
    stripeReconcileNote,
    promoNote:
      "Intro-month promos are one-off Stripe coupons; they do not reduce ongoing MRR after the intro period.",
    generatedAt: new Date().toISOString(),
  };
}
