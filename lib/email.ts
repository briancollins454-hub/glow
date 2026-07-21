import { Resend } from "resend";
import { randomId } from "@/lib/ids";
import { supabaseService } from "@/lib/supabase/service";

// Email sending via Resend. No-ops gracefully if RESEND_API_KEY isn't set, so
// the app (and reminder scheduler) keep working without email configured.

const FROM = process.env.RESEND_FROM ?? "Glow <onboarding@resend.dev>";

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

let client: Resend | null = null;
function getResend(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

async function logOutbound(opts: {
  ok: boolean;
  destination: string;
  subject: string;
  kind?: string;
  error?: string | null;
  techId?: string | null;
  idempotencyKey?: string;
}): Promise<void> {
  try {
    await supabaseService()
      .from("outbound_sends")
      .insert({
        id: randomId("out"),
        channel: "email",
        destination: opts.destination.slice(0, 320),
        subject: opts.subject.slice(0, 500),
        kind: opts.kind ?? null,
        ok: opts.ok,
        error: opts.error ?? null,
        techId: opts.techId ?? null,
        idempotencyKey: opts.idempotencyKey ?? null,
      });
  } catch {
    // Migration may be pending.
  }
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
  replyTo?: string;
  kind?: string;
  techId?: string | null;
}): Promise<boolean> {
  if (!emailConfigured() || !params.to) return false;
  try {
    // The Resend SDK returns { data, error } (it does not throw on API errors).
    const { error } = await getResend().emails.send(
      {
        from: FROM,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        ...(params.replyTo ? { replyTo: params.replyTo } : {}),
      },
      params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined,
    );
    if (error) {
      console.error("[resend] send failed:", error.message);
      await logOutbound({
        ok: false,
        destination: params.to,
        subject: params.subject,
        kind: params.kind,
        error: error.message,
        techId: params.techId,
        idempotencyKey: params.idempotencyKey,
      });
      return false;
    }
    await logOutbound({
      ok: true,
      destination: params.to,
      subject: params.subject,
      kind: params.kind,
      techId: params.techId,
      idempotencyKey: params.idempotencyKey,
    });
    return true;
  } catch (err) {
    console.error("[resend] send threw:", (err as Error).message);
    await logOutbound({
      ok: false,
      destination: params.to,
      subject: params.subject,
      kind: params.kind,
      error: (err as Error).message,
      techId: params.techId,
      idempotencyKey: params.idempotencyKey,
    });
    return false;
  }
}

/** Minimal branded, email-client-safe HTML wrapper. */
export function brandedEmail(opts: {
  brand: string;
  businessName: string;
  heading: string;
  bodyHtml: string;
  buttonLabel?: string;
  buttonUrl?: string;
}): string {
  const button =
    opts.buttonLabel && opts.buttonUrl
      ? `<tr><td style="padding:8px 0 4px;"><a href="${opts.buttonUrl}" style="display:inline-block;background:${opts.brand};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px;">${opts.buttonLabel}</a></td></tr>`
      : "";
  return `<!doctype html><html><body style="margin:0;background:#fbf7f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f1726;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf7f4;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(31,23,38,0.08);">
        <tr><td style="background:${opts.brand};padding:20px 24px;color:#ffffff;font-size:18px;font-weight:600;">${opts.businessName}</td></tr>
        <tr><td style="padding:24px;">
          <h1 style="margin:0 0 12px;font-size:20px;">${opts.heading}</h1>
          <div style="font-size:14px;line-height:1.6;color:#564a5e;">${opts.bodyHtml}</div>
          <table role="presentation" cellpadding="0" cellspacing="0">${button}</table>
        </td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid #eee;font-size:12px;color:#8a7f91;">Powered by Glow</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
