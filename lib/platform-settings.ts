import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditEvent } from "@/lib/db/queries";

export type SignupOfferMode = "trial" | "half_price_first_month";

export const SIGNUP_OFFER_MODE_KEY = "signupOfferMode";
export const DEFAULT_SIGNUP_OFFER_MODE: SignupOfferMode = "half_price_first_month";

export function isSignupOfferMode(value: string | null | undefined): value is SignupOfferMode {
  return value === "trial" || value === "half_price_first_month";
}

export function parseSignupOfferMode(value: string | null | undefined): SignupOfferMode {
  return isSignupOfferMode(value) ? value : DEFAULT_SIGNUP_OFFER_MODE;
}

/** Read the live platform signup offer mode (defaults to half-price). */
export async function getSignupOfferMode(sb: SupabaseClient): Promise<SignupOfferMode> {
  try {
    const { data, error } = await sb
      .from("platform_settings")
      .select("value")
      .eq("key", SIGNUP_OFFER_MODE_KEY)
      .maybeSingle();
    if (error || !data) return DEFAULT_SIGNUP_OFFER_MODE;
    return parseSignupOfferMode(String((data as { value?: string }).value ?? ""));
  } catch {
    return DEFAULT_SIGNUP_OFFER_MODE;
  }
}

/**
 * Owner-only write. Logs an audit event with before/after.
 * Returns the new mode.
 */
export async function setSignupOfferMode(
  sb: SupabaseClient,
  opts: {
    mode: SignupOfferMode;
    actorTechId: string;
    actorEmail: string;
  },
): Promise<SignupOfferMode> {
  const previous = await getSignupOfferMode(sb);
  const now = new Date().toISOString();
  const { error } = await sb.from("platform_settings").upsert({
    key: SIGNUP_OFFER_MODE_KEY,
    value: opts.mode,
    updatedAt: now,
    updatedByTechId: opts.actorTechId,
    updatedByEmail: opts.actorEmail,
  });
  if (error) throw error;

  if (previous !== opts.mode) {
    await createAuditEvent(sb, {
      techId: opts.actorTechId,
      actor: "tech",
      action: "signup_offer_mode_changed",
      entityType: "platform_settings",
      entityId: SIGNUP_OFFER_MODE_KEY,
      metadata: {
        from: previous,
        to: opts.mode,
        by: opts.actorEmail,
        at: now,
        as: "owner",
      },
    }).catch(() => undefined);
  }

  return opts.mode;
}
