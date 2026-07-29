import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseService } from "@/lib/supabase/service";
import { randomId } from "@/lib/ids";
import {
  applyComplaint,
  applyHardBounce,
  applySoftBounce,
  classifyBounce,
  markOutboundDelivery,
  normaliseEmail,
} from "@/lib/email-suppression";

async function logResendWebhookEvent(opts: {
  svixId: string | null;
  type: string;
  emailId: string | null;
  ok: boolean;
  error?: string | null;
  payload: unknown;
}): Promise<void> {
  try {
    const id = opts.svixId ? `rwh_${opts.svixId}` : randomId("rwh");
    await supabaseService().from("resend_webhook_events").upsert(
      {
        id,
        svixId: opts.svixId,
        type: opts.type,
        emailId: opts.emailId,
        ok: opts.ok,
        error: opts.error ?? null,
        payload: opts.payload ?? {},
        receivedAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
      },
      { onConflict: "svixId" },
    );
  } catch {
    // Table may be missing until migration 0060.
  }
}

/**
 * Resend delivery webhooks: bounce / complaint / delayed.
 * Configure a separate Resend webhook (its own signing secret) for
 * email.bounced, email.complained, and email.delivery_delayed → this route.
 * Signing secret: RESEND_EVENTS_WEBHOOK_SECRET (do NOT reuse the inbound secret).
 *
 * Inbound mail stays on /api/resend/inbound with RESEND_WEBHOOK_SECRET.
 * Accepts email.delivered_delayed as an alias for email.delivery_delayed.
 */

type DeliveryEventData = {
  email_id?: string;
  to?: string[];
  subject?: string;
  bounce?: { type?: string | null; message?: string | null; subType?: string | null };
};

function firstRecipient(data: DeliveryEventData): string {
  const raw = Array.isArray(data.to) ? data.to[0] : "";
  return normaliseEmail(String(raw ?? ""));
}

function unauthorized(reason: string) {
  console.error(
    "[resend/webhook] signature failure",
    JSON.stringify({
      endpoint: "/api/resend/webhook",
      reason,
      hint: "Use RESEND_EVENTS_WEBHOOK_SECRET from the delivery-events Resend webhook, not RESEND_WEBHOOK_SECRET (inbound).",
    }),
  );
  return NextResponse.json(
    { error: "unauthorized", reason, endpoint: "/api/resend/webhook" },
    { status: 401 },
  );
}

export async function POST(req: Request) {
  const webhookSecret = process.env.RESEND_EVENTS_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return unauthorized("RESEND_EVENTS_WEBHOOK_SECRET is missing");
  }

  // verify() is local (Svix); API key is unused here but Resend's ctor expects one.
  const resend = new Resend(process.env.RESEND_API_KEY || "re_unused_for_verify");
  const payload = await req.text();

  let event: { type: string; data: DeliveryEventData };
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: req.headers.get("svix-id") ?? "",
        timestamp: req.headers.get("svix-timestamp") ?? "",
        signature: req.headers.get("svix-signature") ?? "",
      },
      webhookSecret,
    }) as { type: string; data: DeliveryEventData };
  } catch (err) {
    return unauthorized(
      `invalid signature: ${(err as Error)?.message || "verification failed"}`,
    );
  }

  const type = event.type;
  const svixId = req.headers.get("svix-id");
  // Official Resend name is email.delivery_delayed; accept the alias too.
  const isDelayed = type === "email.delivery_delayed" || type === "email.delivered_delayed";
  const handled = type === "email.bounced" || type === "email.complained" || isDelayed;
  if (!handled) {
    await logResendWebhookEvent({
      svixId,
      type,
      emailId: null,
      ok: true,
      payload: event,
      error: "skipped",
    });
    // Acknowledge unknown types so Resend does not retry forever.
    return NextResponse.json({ ok: true, skipped: type });
  }

  const data = event.data ?? {};
  const resendEmailId = String(data.email_id ?? "");
  const email = firstRecipient(data);
  const bounceType = data.bounce?.type ?? null;
  const bounceMessage = data.bounce?.message ?? null;

  const sb = supabaseService();

  try {
    if (isDelayed) {
      await markOutboundDelivery(sb, {
        resendEmailId,
        deliveryStatus: "delivery_delayed",
        destination: email,
      });
      await logResendWebhookEvent({
        svixId,
        type,
        emailId: resendEmailId || null,
        ok: true,
        payload: event,
      });
      return NextResponse.json({ ok: true, event: type });
    }

    if (type === "email.complained") {
      const outbound = await markOutboundDelivery(sb, {
        resendEmailId,
        deliveryStatus: "complained",
        error: "recipient marked as spam",
        destination: email,
      });
      if (email) {
        const result = await applyComplaint(sb, {
          email,
          resendEmailId,
          outboundId: outbound?.id ?? null,
        });
        await logResendWebhookEvent({
          svixId,
          type,
          emailId: resendEmailId || null,
          ok: true,
          payload: event,
        });
        return NextResponse.json({
          ok: true,
          event: type,
          suppressed: result.suppressed,
          accountProtected: result.accountProtected,
        });
      }
      await logResendWebhookEvent({
        svixId,
        type,
        emailId: resendEmailId || null,
        ok: true,
        payload: event,
      });
      return NextResponse.json({ ok: true, event: type, suppressed: false });
    }

    // email.bounced
    const outbound = await markOutboundDelivery(sb, {
      resendEmailId,
      deliveryStatus: "bounced",
      bounceType,
      error: bounceMessage,
      destination: email,
    });

    if (!email) {
      await logResendWebhookEvent({
        svixId,
        type,
        emailId: resendEmailId || null,
        ok: true,
        payload: event,
      });
      return NextResponse.json({ ok: true, event: type, note: "no recipient" });
    }

    if (classifyBounce(bounceType) === "hard") {
      const result = await applyHardBounce(sb, {
        email,
        resendEmailId,
        outboundId: outbound?.id ?? null,
      });
      await logResendWebhookEvent({
        svixId,
        type,
        emailId: resendEmailId || null,
        ok: true,
        payload: event,
      });
      return NextResponse.json({
        ok: true,
        event: type,
        suppressed: result.suppressed,
        accountProtected: result.accountProtected,
        reason: "hard_bounce",
      });
    }

    const { suppression, newlySuppressed, suppressed, accountProtected } = await applySoftBounce(
      sb,
      {
        email,
        resendEmailId,
        outboundId: outbound?.id ?? null,
      },
    );
    await logResendWebhookEvent({
      svixId,
      type,
      emailId: resendEmailId || null,
      ok: true,
      payload: event,
    });
    return NextResponse.json({
      ok: true,
      event: type,
      suppressed,
      newlySuppressed,
      accountProtected,
      consecutiveSoftFailures: suppression?.consecutiveSoftFailures ?? 0,
      reason: suppression?.reason ?? null,
    });
  } catch (err) {
    console.error("[resend/webhook] handler failed", (err as Error).message);
    await logResendWebhookEvent({
      svixId,
      type,
      emailId: resendEmailId || null,
      ok: false,
      error: (err as Error).message,
      payload: event,
    });
    try {
      const { reportError } = await import("@/lib/monitor");
      await reportError(err, { where: "resend.webhook", context: { type, resendEmailId, email } });
    } catch {
      // ignore
    }
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
}
