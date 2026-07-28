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
 * Configure a Resend webhook for email.bounced, email.complained, and
 * email.delivery_delayed pointing at /api/resend/webhook (same
 * RESEND_WEBHOOK_SECRET as inbound, or a dedicated secret).
 *
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

export async function POST(req: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_API_KEY;
  if (!webhookSecret || !apiKey) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const resend = new Resend(apiKey);
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
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const type = event.type;
  // Official Resend name is email.delivery_delayed; accept the alias too.
  const isDelayed = type === "email.delivery_delayed" || type === "email.delivered_delayed";
  const handled = type === "email.bounced" || type === "email.complained" || isDelayed;
  if (!handled) {
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
    console.error("[resend webhook]", (err as Error).message);
    try {
      const { reportError } = await import("@/lib/monitor");
      await reportError(err, { where: "resend.webhook", context: { type, resendEmailId, email } });
    } catch {
      // ignore
    }
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
}
