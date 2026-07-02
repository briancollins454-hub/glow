import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { updateTech } from "@/lib/db/queries";
import type { Tech } from "@/lib/db/types";

// Stripe Connect helpers. Each tech has an Express connected account; client
// deposits/balances are charged directly on that account (Glow takes 0%).

/** Ensure the tech has a connected account, returning its id. */
export async function ensureConnectAccount(sb: SupabaseClient, tech: Tech): Promise<string> {
  if (tech.stripeConnectAccountId) return tech.stripeConnectAccountId;
  const s = stripe();
  const account = await s.accounts.create({
    type: "express",
    email: tech.email,
    business_type: "individual",
    metadata: { techId: tech.id },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });
  await updateTech(sb, tech.id, { stripeConnectAccountId: account.id });
  return account.id;
}

/** Create a hosted onboarding link for the connected account. */
export async function createOnboardingLink(accountId: string, appUrl: string): Promise<string> {
  const s = stripe();
  const link = await s.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/dashboard/payments?refresh=1`,
    return_url: `${appUrl}/dashboard/payments?done=1`,
    type: "account_onboarding",
  });
  return link.url;
}

/** Pull the latest capability flags from Stripe and persist them. */
export async function syncConnectStatus(
  sb: SupabaseClient,
  tech: Tech,
): Promise<{ chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean }> {
  if (!tech.stripeConnectAccountId) {
    return { chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false };
  }
  const s = stripe();
  const acct = await s.accounts.retrieve(tech.stripeConnectAccountId);
  const flags = {
    chargesEnabled: !!acct.charges_enabled,
    payoutsEnabled: !!acct.payouts_enabled,
    detailsSubmitted: !!acct.details_submitted,
  };
  await updateTech(sb, tech.id, {
    connectChargesEnabled: flags.chargesEnabled,
    connectPayoutsEnabled: flags.payoutsEnabled,
    connectDetailsSubmitted: flags.detailsSubmitted,
  });
  return flags;
}
