import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseService } from "@/lib/supabase/service";
import {
  applyComplaint,
  applyHardBounce,
  applySoftBounce,
  classifyBounce,
  markOutboundDelivery,
  normaliseEmail,
} from "@/lib/email-suppression";

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
  // Official Resend name is email.delivery_delayed; accept the alias too.
  const isDelayed = type === "email.delivery_delayed" || type === "email.delivered_delayed";
  const handled = type === "email.bounced" || type === "email.complained" || isDelayed;
  if (!handled) {
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
      });
      return NextResponse.json({ ok: true, event: type });
    }

    if (type === "email.complained") {
      const outbound = await markOutboundDelivery(sb, {
        resendEmailId,
        deliveryStatus: "complained",
        error: "recipient marked as spam",
      });
      if (email) {
        await applyComplaint(sb, {
          email,
          resendEmailId,
          outboundId: outbound?.id ?? null,
        });
      }
      return NextResponse.json({ ok: true, event: type, suppressed: true });
    }

    // email.bounced
    const outbound = await markOutboundDelivery(sb, {
      resendEmailId,
      deliveryStatus: "bounced",
      bounceType,
      error: bounceMessage,
    });

    if (!email) {
      return NextResponse.json({ ok: true, event: type, note: "no recipient" });
    }

    if (classifyBounce(bounceType) === "hard") {
      await applyHardBounce(sb, {
        email,
        resendEmailId,
        outboundId: outbound?.id ?? null,
      });
      return NextResponse.json({ ok: true, event: type, suppressed: true, reason: "hard_bounce" });
    }

    const { suppression, newlySuppressed } = await applySoftBounce(sb, {
      email,
      resendEmailId,
      outboundId: outbound?.id ?? null,
    });
    return NextResponse.json({
      ok: true,
      event: type,
      suppressed: suppression.suppressed,
      newlySuppressed,
      consecutiveSoftFailures: suppression.consecutiveSoftFailures,
      reason: suppression.reason,
    });
  } catch (err) {
    console.error("[resend/webhook] handler failed", (err as Error).message);
    try {
      const { reportError } = await import("@/lib/monitor");
      await reportError(err, { where: "resend.webhook", context: { type, resendEmailId, email } });
    } catch {
      // ignore
    }
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
}
