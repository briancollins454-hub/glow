import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTechByHandle, updateTech } from "@/lib/db/queries";
import type { Tech } from "@/lib/db/types";
import { LIST_MONTHLY_PENNIES } from "@/lib/owner/mrr";

/**
 * When a referred tech becomes a paying member, credit one free month (£19)
 * to the referrer's Stripe customer balance. Once per referred tech.
 *
 * Stacking with launch coupon: the referred tech's first invoice uses the
 * Stripe coupon; this balance credit lands on the referrer and is consumed
 * on their subsequent invoices (typically invoice 2+ for the referrer).
 */
export async function maybeGrantReferralCredit(
  sb: SupabaseClient,
  s: Stripe,
  tech: Tech,
  status: string,
): Promise<void> {
  if (status !== "active" && status !== "trialing") return;
  if (!tech.referredBy) return;
  if (tech.referralCreditGrantedAt) return;

  const referrer = await getTechByHandle(sb, tech.referredBy);
  if (!referrer?.stripeCustomerId) return;

  // Idempotency: mark first so a concurrent webhook cannot double-credit.
  const grantedAt = new Date().toISOString();
  await updateTech(sb, tech.id, { referralCreditGrantedAt: grantedAt });

  try {
    // Negative balance = credit toward future invoices.
    await s.customers.createBalanceTransaction(referrer.stripeCustomerId, {
      amount: -LIST_MONTHLY_PENNIES,
      currency: "gbp",
      description: `Referral free month for ${tech.handle}`,
      metadata: {
        referredTechId: tech.id,
        referredHandle: tech.handle,
        kind: "referral_free_month",
      },
    });
  } catch (err) {
    // Roll back the flag so a later webhook can retry.
    await updateTech(sb, tech.id, { referralCreditGrantedAt: null });
    throw err;
  }
}
