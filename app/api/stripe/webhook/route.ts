import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseService } from "@/lib/supabase/service";
import { claimStripeWebhookEvent } from "@/lib/stripe-webhook-idempotency";
import { processStripeEventForReplay } from "@/lib/stripe-webhook-process";

/**
 * Stripe webhook. Verifies the signature, then updates tech subscription
 * state and (for Connect charge events) booking payment status.
 *
 * Handlers are idempotent under duplicate delivery via stripe_webhook_events.
 *
 * Required env: STRIPE_WEBHOOK_SECRET
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 400 });

  const body = await request.text();
  const sig = request.headers.get("stripe-signature") ?? "";
  const s = stripe();

  let event;
  try {
    event = s.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json({ error: `signature: ${(err as Error).message}` }, { status: 400 });
  }

  const sb = supabaseService();
  const claimed = await claimStripeWebhookEvent(sb, {
    eventId: event.id,
    type: event.type,
  });
  if (!claimed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Store payload for owner console replay / inspection (migration 0060).
  try {
    await sb
      .from("stripe_webhook_events")
      .update({
        payload: event as unknown as Record<string, unknown>,
        signatureValid: true,
      })
      .eq("eventId", event.id);
  } catch {
    // column may be missing pre-0060
  }

  try {
    await processStripeEventForReplay(event);
  } catch (err) {
    console.error("[stripe webhook]", (err as Error).message);
    // Allow Stripe retries after a failed handler (undo claim).
    try {
      await sb.from("stripe_webhook_events").delete().eq("eventId", event.id);
    } catch {
      // ignore
    }
    try {
      const { reportError } = await import("@/lib/monitor");
      await reportError(err, { where: "stripe_webhook", type: event.type });
    } catch {
      // ignore
    }
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
