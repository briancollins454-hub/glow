/**
 * Webhook / integration inspector (Phase 3.6).
 */

import { supabaseService } from "@/lib/supabase/service";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { claimStripeWebhookEvent } from "@/lib/stripe-webhook-idempotency";

export type StripeWebhookRow = {
  eventId: string;
  type: string;
  techId: string | null;
  processedAt: string;
  signatureValid?: boolean;
  replayCount?: number;
  error?: string | null;
  hasPayload: boolean;
};

export type ResendWebhookRow = {
  id: string;
  svixId: string | null;
  type: string;
  emailId: string | null;
  ok: boolean;
  error: string | null;
  receivedAt: string;
};

export async function listStripeWebhookEvents(opts?: {
  failuresOnly?: boolean;
  limit?: number;
}): Promise<StripeWebhookRow[]> {
  let q = supabaseService()
    .from("stripe_webhook_events")
    .select("*")
    .order("processedAt", { ascending: false })
    .limit(opts?.limit ?? 80);
  if (opts?.failuresOnly) q = q.not("error", "is", null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    eventId: r.eventId,
    type: r.type,
    techId: r.techId,
    processedAt: r.processedAt,
    signatureValid: r.signatureValid ?? true,
    replayCount: r.replayCount ?? 0,
    error: r.error ?? null,
    hasPayload: !!r.payload,
  }));
}

export async function listResendWebhookEvents(limit = 80): Promise<ResendWebhookRow[]> {
  const { data, error } = await supabaseService()
    .from("resend_webhook_events")
    .select("*")
    .order("receivedAt", { ascending: false })
    .limit(limit);
  if (error) {
    // Table may be missing pre-0060
    return [];
  }
  return (data ?? []) as ResendWebhookRow[];
}

/**
 * Replay a Stripe event by id. Idempotent: reclaim after deleting prior claim,
 * or re-fetch from Stripe API and re-process via dynamic import of handlers.
 * Returns whether processing was attempted.
 */
export async function replayStripeWebhookEvent(
  eventId: string,
): Promise<{ ok: boolean; detail: string }> {
  if (!stripeConfigured()) return { ok: false, detail: "Stripe not configured" };
  const sb = supabaseService();
  const { data: row } = await sb
    .from("stripe_webhook_events")
    .select("*")
    .eq("eventId", eventId)
    .maybeSingle();

  const s = stripe();
  let event;
  try {
    event = await s.events.retrieve(eventId);
  } catch (e) {
    return { ok: false, detail: (e as Error).message };
  }

  // Allow re-processing: delete claim then reclaim (idempotent second claim fails → still ok if we force)
  await sb.from("stripe_webhook_events").delete().eq("eventId", eventId);
  const claimed = await claimStripeWebhookEvent(sb, {
    eventId: event.id,
    type: event.type,
    techId: row?.techId ?? null,
  });
  if (!claimed) {
    return { ok: false, detail: "Could not reclaim event id" };
  }

  await sb
    .from("stripe_webhook_events")
    .update({
      payload: event as unknown as Record<string, unknown>,
      replayCount: (row?.replayCount ?? 0) + 1,
      error: null,
    })
    .eq("eventId", eventId);

  try {
    const { processStripeEventForReplay } = await import("@/lib/stripe-webhook-process");
    await processStripeEventForReplay(event);
  } catch (e) {
    await sb
      .from("stripe_webhook_events")
      .update({ error: (e as Error).message })
      .eq("eventId", eventId);
    return { ok: false, detail: (e as Error).message };
  }

  return {
    ok: true,
    detail: `Replayed ${event.type}; replayCount=${(row?.replayCount ?? 0) + 1}`,
  };
}

export async function getIntegrationHealth(): Promise<
  {
    provider: string;
    lastSuccessAt: string | null;
    lastErrorAt: string | null;
    errorCount24h: number;
    successCount24h: number;
  }[]
> {
  const sb = supabaseService();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const providers = [
    { provider: "stripe", channel: null as string | null },
    { provider: "resend", channel: "email" },
    { provider: "twilio", channel: "sms" },
  ];
  const out = [];
  for (const p of providers) {
    if (p.channel) {
      const { data: ok } = await sb
        .from("outbound_sends")
        .select("createdAt")
        .eq("channel", p.channel)
        .eq("ok", true)
        .order("createdAt", { ascending: false })
        .limit(1);
      const { data: bad } = await sb
        .from("outbound_sends")
        .select("createdAt")
        .eq("channel", p.channel)
        .eq("ok", false)
        .order("createdAt", { ascending: false })
        .limit(1);
      const { count: successCount24h } = await sb
        .from("outbound_sends")
        .select("id", { count: "exact", head: true })
        .eq("channel", p.channel)
        .eq("ok", true)
        .gte("createdAt", since);
      const { count: errorCount24h } = await sb
        .from("outbound_sends")
        .select("id", { count: "exact", head: true })
        .eq("channel", p.channel)
        .eq("ok", false)
        .gte("createdAt", since);
      out.push({
        provider: p.provider,
        lastSuccessAt: ok?.[0]?.createdAt ?? null,
        lastErrorAt: bad?.[0]?.createdAt ?? null,
        successCount24h: successCount24h ?? 0,
        errorCount24h: errorCount24h ?? 0,
      });
    } else {
      const { data: last } = await sb
        .from("stripe_webhook_events")
        .select("processedAt")
        .order("processedAt", { ascending: false })
        .limit(1);
      out.push({
        provider: "stripe",
        lastSuccessAt: last?.[0]?.processedAt ?? null,
        lastErrorAt: null,
        successCount24h: 0,
        errorCount24h: 0,
      });
    }
  }
  return out;
}
