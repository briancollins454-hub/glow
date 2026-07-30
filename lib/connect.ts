import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { updateTech } from "@/lib/db/queries";
import { salonCountry } from "@/lib/locale";
import type { Tech } from "@/lib/db/types";

// Stripe Connect helpers. Each tech has an Express connected account; client
// deposits/balances are charged directly on that account (Glow takes 0%).

/**
 * Countries this platform can create Express connected accounts in.
 * Confirm against the Stripe dashboard (Settings → Connect) before adding
 * more — creating an account in an unenabled country fails at onboarding.
 * Salons outside this list run with online client payments off; everything
 * else (booking, diary, reminders) works normally.
 */
export const CONNECT_SUPPORTED_COUNTRIES = new Set([
  "GB",
  "IE",
  "US",
  "AU",
  "NZ",
  "CA",
  "DE",
  "FR",
  "ES",
  "IT",
  "NL",
  "BE",
  "PT",
  "AT",
  "CH",
  "SE",
  "NO",
  "DK",
  "PL",
  "CZ",
  "AE",
  "SG",
  "HK",
  "JP",
  "MX",
]);

/** Whether online client payments (Stripe Connect) are available in the salon's country. */
export function connectCountrySupported(
  tech: Pick<Tech, "country"> | null | undefined,
): boolean {
  return CONNECT_SUPPORTED_COUNTRIES.has(salonCountry(tech));
}

/** Client-safe copy for salons whose country has no Connect support. */
export const CONNECT_UNSUPPORTED_MESSAGE =
  "Online client payments are not available in your country yet. You can still take payment in person and record it in Glow. Everything else works normally.";

export type EnsureConnectAccountResult =
  | { ok: true; accountId: string }
  | { ok: false; reason: "unsupported_country"; message: string };

/** Ensure the tech has a connected account, returning its id. */
export async function ensureConnectAccount(
  sb: SupabaseClient,
  tech: Tech,
): Promise<EnsureConnectAccountResult> {
  // Existing accounts (all GB pre-rollout) are unaffected by the country gate.
  if (tech.stripeConnectAccountId) return { ok: true, accountId: tech.stripeConnectAccountId };
  if (!connectCountrySupported(tech)) {
    return { ok: false, reason: "unsupported_country", message: CONNECT_UNSUPPORTED_MESSAGE };
  }
  const s = stripe();
  const account = await s.accounts.create({
    type: "express",
    email: tech.email,
    business_type: "individual",
    // Stripe cannot change an account's country after creation, so this must
    // be right first time — it comes from the salon's saved locale.
    country: salonCountry(tech),
    metadata: { techId: tech.id },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });
  await updateTech(sb, tech.id, { stripeConnectAccountId: account.id });
  return { ok: true, accountId: account.id };
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

/**
 * One-time Express dashboard login link for the connected account.
 * Single-use and short-lived — generate fresh on every click; never cache.
 * Only call with the current tech's own stripeConnectAccountId.
 */
export async function createExpressLoginLink(accountId: string): Promise<string> {
  const s = stripe();
  const link = await s.accounts.createLoginLink(accountId);
  if (!link.url) throw new Error("Stripe returned no login link URL");
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
