/**
 * Honest Glow subscription MRR/ARR from account rows.
 *
 * List prices (GBP): monthly £19, annual £180/yr (= £15/mo).
 * Testers get £1 first month only; that intro is NOT recurring MRR.
 * Trialing and complimentary accounts contribute £0 to MRR.
 *
 * When Stripe reconcile is available, prefer Stripe amounts for active subs.
 */

import type { Tech } from "@/lib/db/types";

export const LIST_MONTHLY_PENNIES = 1900;
export const LIST_ANNUAL_PENNIES = 18000;
export const LIST_ANNUAL_MRR_PENNIES = Math.round(LIST_ANNUAL_PENNIES / 12); // 1500

export type MrrBreakdown = {
  /** Recurring monthly revenue in pennies from active (paying) accounts only. */
  mrrPennies: number;
  arrPennies: number;
  payingMonthly: number;
  payingAnnual: number;
  /** Accounts counted in MRR. */
  payingCount: number;
  /** Active testers still on list MRR after intro (we cannot see remaining coupon months without Stripe). */
  note: string;
};

export function planMrrPennies(plan: string | null | undefined): number {
  if (plan === "annual") return LIST_ANNUAL_MRR_PENNIES;
  if (plan === "monthly") return LIST_MONTHLY_PENNIES;
  return 0;
}

/** MRR from DB subscriptionStatus + plan. Does not invent numbers for unknown plans. */
export function computeMrrFromTechs(techs: Pick<Tech, "subscriptionStatus" | "plan" | "signupOffer">[]): MrrBreakdown {
  let mrrPennies = 0;
  let payingMonthly = 0;
  let payingAnnual = 0;

  for (const t of techs) {
    if (t.subscriptionStatus !== "active") continue;
    if (t.plan === "monthly") {
      mrrPennies += LIST_MONTHLY_PENNIES;
      payingMonthly++;
    } else if (t.plan === "annual") {
      mrrPennies += LIST_ANNUAL_MRR_PENNIES;
      payingAnnual++;
    }
    // Unknown plan: skip (do not guess).
  }

  return {
    mrrPennies,
    arrPennies: mrrPennies * 12,
    payingMonthly,
    payingAnnual,
    payingCount: payingMonthly + payingAnnual,
    note:
      "MRR uses list prices for subscriptionStatus=active only (£19/mo, £15/mo for annual). Trialing, complimentary, past_due and cancelled are excluded. Tester £1 intro is not recurring MRR.",
  };
}

export function gbpFromPennies(pennies: number): string {
  return `£${(pennies / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
