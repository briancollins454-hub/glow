import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Record a Stripe event id. Returns false if already processed (duplicate delivery).
 */
export async function claimStripeWebhookEvent(
  sb: SupabaseClient,
  opts: { eventId: string; type: string; techId?: string | null },
): Promise<boolean> {
  const { error } = await sb.from("stripe_webhook_events").insert({
    eventId: opts.eventId,
    type: opts.type,
    techId: opts.techId ?? null,
    processedAt: new Date().toISOString(),
  });
  if (!error) return true;
  // Unique violation = already processed
  if (/duplicate|unique|23505/i.test(error.message)) return false;
  // Table may be missing pre-migration — allow processing once.
  console.warn("[stripe webhook] claim failed:", error.message);
  return true;
}
