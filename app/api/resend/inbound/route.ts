import { NextResponse } from "next/server";
import { Resend } from "resend";

// Inbound support email: Resend receives mail for glow-uk.com (MX record),
// fires email.received, and we forward the full message (passthrough,
// attachments included) to the support inbox.

const SUPPORT_FORWARD_TO = process.env.SUPPORT_FORWARD_TO ?? "brian@thesupportsdesk.com";
const FROM = "Glow Support <support@glow-uk.com>";

export async function POST(req: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_API_KEY;
  if (!webhookSecret || !apiKey) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  const resend = new Resend(apiKey);
  const payload = await req.text();

  let event: ReturnType<typeof resend.webhooks.verify>;
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: req.headers.get("svix-id") ?? "",
        timestamp: req.headers.get("svix-timestamp") ?? "",
        signature: req.headers.get("svix-signature") ?? "",
      },
      webhookSecret,
    });
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type !== "email.received") {
    return NextResponse.json({ ok: true, skipped: event.type });
  }

  const { error } = await resend.emails.receiving.forward({
    emailId: event.data.email_id,
    to: SUPPORT_FORWARD_TO,
    from: FROM,
    passthrough: true,
  });
  if (error) {
    console.error("[inbound] forward failed:", error.message);
    // Non-200 so Resend retries later.
    return NextResponse.json({ error: "forward failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
