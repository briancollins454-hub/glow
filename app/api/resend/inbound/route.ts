import { NextResponse } from "next/server";
import { Resend } from "resend";
import { randomId } from "@/lib/ids";
import { supabaseService } from "@/lib/supabase/service";

// Inbound support email: Resend receives mail for glow-uk.com (MX record),
// fires email.received, and we forward the message to the support inbox.
// The forward keeps the original sender visible and sets reply-to to them,
// so replying from the inbox goes straight back to the person who wrote in.

const SUPPORT_FORWARD_TO = process.env.SUPPORT_FORWARD_TO ?? "brian@thesupportsdesk.com";
const FROM = "Glow Support <support@glow-uk.com>";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function logForward(opts: {
  resendEmailId?: string;
  fromAddress?: string;
  subject?: string;
  ok: boolean;
  error?: string;
}) {
  try {
    await supabaseService()
      .from("inbound_forwards")
      .insert({
        id: randomId("inf"),
        resendEmailId: opts.resendEmailId ?? null,
        fromAddress: opts.fromAddress ?? null,
        subject: opts.subject ?? null,
        ok: opts.ok,
        error: opts.error ?? null,
      });
  } catch {
    // Migration may be pending.
  }
}

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

  const { data: email, error: getError } = await resend.emails.receiving.get(
    event.data.email_id,
  );
  if (getError || !email) {
    console.error("[inbound] fetch failed:", getError?.message);
    await logForward({
      resendEmailId: event.data.email_id,
      ok: false,
      error: getError?.message ?? "fetch failed",
    });
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }

  const { data: attachmentsData } = await resend.emails.receiving.attachments.list({
    emailId: event.data.email_id,
  });
  const attachments = (attachmentsData?.data ?? []).map((a) => ({
    path: a.download_url,
    filename: a.filename ?? undefined,
    contentType: a.content_type ?? undefined,
    contentId: a.content_id ?? undefined,
  }));

  const sender = email.from || "unknown sender";
  const subject = email.subject || "(no subject)";
  const banner = `From: ${sender}`;
  const html =
    `<p style="margin:0 0 4px;padding:8px 12px;background:#f5f0ee;border-radius:8px;font-size:13px;color:#564a5e">${escapeHtml(banner)} &middot; reply goes directly to them</p><hr style="border:none;border-top:1px solid #eee;margin:12px 0"/>` +
    (email.html ?? `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(email.text ?? "")}</pre>`);
  const text = `${banner}\n----------------------------------------\n${email.text ?? ""}`;

  const { error: sendError } = await resend.emails.send({
    from: FROM,
    to: SUPPORT_FORWARD_TO,
    replyTo: sender,
    subject,
    html,
    text,
    attachments,
  });
  if (sendError) {
    console.error("[inbound] forward failed:", sendError.message);
    await logForward({
      resendEmailId: event.data.email_id,
      fromAddress: sender,
      subject,
      ok: false,
      error: sendError.message,
    });
    return NextResponse.json({ error: "forward failed" }, { status: 500 });
  }

  await logForward({
    resendEmailId: event.data.email_id,
    fromAddress: sender,
    subject,
    ok: true,
  });

  return NextResponse.json({ ok: true });
}
