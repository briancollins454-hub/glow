import { sendEmail } from "@/lib/email";

// Lightweight error monitoring: logs everything, and emails the ops inbox for
// server errors (rate-limited per error signature so a hot loop can't flood
// the inbox). Uses Resend, so it needs no extra provider or SDK.

const OPS_EMAIL = process.env.OPS_ALERT_EMAIL ?? "support@glow-uk.com";
const WINDOW_MS = 15 * 60 * 1000;

// Per-instance rate limit. Serverless instances each keep their own map, which
// still caps the flood to one email per signature per instance per window.
const lastSent = new Map<string, number>();

export async function reportError(error: unknown, context: Record<string, unknown> = {}): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));
  const signature = `${err.name}:${err.message}`.slice(0, 200);

  console.error("[glow-error]", signature, JSON.stringify(context), err.stack ?? "");

  const now = Date.now();
  const last = lastSent.get(signature) ?? 0;
  if (now - last < WINDOW_MS) return;
  lastSent.set(signature, now);

  try {
    const contextText = Object.entries(context)
      .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join("\n");
    await sendEmail({
      to: OPS_EMAIL,
      subject: `[Glow error] ${signature.slice(0, 80)}`,
      html: `<pre style="font-family:monospace;white-space:pre-wrap">${escapeHtml(
        `${signature}\n\n${contextText}\n\n${err.stack ?? "(no stack)"}`,
      )}</pre>`,
      text: `${signature}\n\n${contextText}\n\n${err.stack ?? "(no stack)"}`,
    });
  } catch {
    // Monitoring must never throw into the request path.
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
