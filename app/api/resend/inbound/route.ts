import { NextResponse } from "next/server";
import { Resend } from "resend";
import { randomId } from "@/lib/ids";
import { supabaseService } from "@/lib/supabase/service";
import { isValidEmail } from "@/lib/email";
import { normaliseEmail } from "@/lib/email-suppression";

// Inbound email: Resend receives mail for glow-uk.com (MX record) and fires
// email.received. Client replies are matched to the salon they relate to (by
// the client/booking behind the sender's address) and forwarded to that
// salon. Only unmatched mail goes to the platform support inbox.
// The forward keeps the original sender visible and sets reply-to to them,
// so replying from the inbox goes straight back to the person who wrote in.

const SUPPORT_FORWARD_TO = process.env.SUPPORT_FORWARD_TO ?? "brian@thesupportsdesk.com";
const FROM = "Glow Support <support@glow-uk.com>";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** "Bella Rose" <bella@x.com> → bella@x.com */
function extractAddress(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
}

type MatchedSalon = { id: string; email: string; businessName: string | null };

/**
 * Match an inbound sender to the salon their reply relates to: find client
 * records with that email; if the address belongs to clients at several
 * salons, prefer the salon of the most recent booking (that's the thread the
 * client is most likely replying to). Returns null when no salon matches or
 * the salon has no usable email.
 */
async function matchSalonForSender(senderAddress: string): Promise<MatchedSalon | null> {
  const key = normaliseEmail(senderAddress);
  if (!key) return null;
  const sb = supabaseService();
  // ilike with wildcards escaped = case-insensitive equality.
  const pattern = key.replace(/([%_\\])/g, "\\$1");
  const { data: clients } = await sb
    .from("clients")
    .select("id, techId")
    .ilike("email", pattern)
    .limit(25);
  const clientIds = (clients ?? []).map((c) => c.id as string);
  const techIds = [...new Set((clients ?? []).map((c) => c.techId as string))];
  if (techIds.length === 0) return null;

  let techId = techIds[0];
  if (techIds.length > 1) {
    const { data: recent } = await sb
      .from("bookings")
      .select("techId, startIso")
      .in("clientId", clientIds)
      .order("startIso", { ascending: false })
      .limit(1);
    techId = (recent?.[0]?.techId as string | undefined) ?? techId;
  }

  const { data: tech } = await sb
    .from("techs")
    .select("id, email, businessName")
    .eq("id", techId)
    .maybeSingle();
  const email = (tech?.email as string | undefined)?.trim() ?? "";
  if (!tech || !email || !isValidEmail(email)) return null;
  return { id: tech.id as string, email, businessName: (tech.businessName as string | null) ?? null };
}

async function logForward(opts: {
  resendEmailId?: string;
  fromAddress?: string;
  subject?: string;
  ok: boolean;
  error?: string;
  forwardedTo?: string | null;
  matchedTechId?: string | null;
}) {
  try {
    const sb = supabaseService();
    const row = {
      id: randomId("inf"),
      resendEmailId: opts.resendEmailId ?? null,
      fromAddress: opts.fromAddress ?? null,
      subject: opts.subject ?? null,
      ok: opts.ok,
      error: opts.error ?? null,
    };
    const { error } = await sb.from("inbound_forwards").insert({
      ...row,
      forwardedTo: opts.forwardedTo ?? null,
      matchedTechId: opts.matchedTechId ?? null,
    });
    if (error) {
      // Migration 0067 (forwardedTo/matchedTechId) may be pending.
      await sb.from("inbound_forwards").insert(row);
    }
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

  // Route client replies to the salon the thread relates to. Only unmatched
  // mail (no client/booking behind the sender) goes to the platform inbox.
  const salon = await matchSalonForSender(extractAddress(sender)).catch((err) => {
    console.warn("[inbound] salon match failed:", (err as Error).message);
    return null;
  });
  const forwardTo = salon?.email ?? SUPPORT_FORWARD_TO;

  const banner = salon
    ? `From: ${sender} · a client of ${salon.businessName || "your salon"}`
    : `From: ${sender}`;
  const html =
    `<p style="margin:0 0 4px;padding:8px 12px;background:#f5f0ee;border-radius:8px;font-size:13px;color:#564a5e">${escapeHtml(banner)} &middot; reply goes directly to them</p><hr style="border:none;border-top:1px solid #eee;margin:12px 0"/>` +
    (email.html ?? `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(email.text ?? "")}</pre>`);
  const text = `${banner}\n----------------------------------------\n${email.text ?? ""}`;

  const { error: sendError } = await resend.emails.send({
    from: FROM,
    to: forwardTo,
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
      forwardedTo: forwardTo,
      matchedTechId: salon?.id ?? null,
    });
    return NextResponse.json({ error: "forward failed" }, { status: 500 });
  }

  await logForward({
    resendEmailId: event.data.email_id,
    fromAddress: sender,
    subject,
    ok: true,
    forwardedTo: forwardTo,
    matchedTechId: salon?.id ?? null,
  });

  return NextResponse.json({ ok: true });
}
