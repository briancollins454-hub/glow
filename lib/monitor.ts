import { sendEmail } from "@/lib/email";
import { randomId } from "@/lib/ids";
import { supabaseService } from "@/lib/supabase/service";

// Lightweight error monitoring: logs everything, emails the ops inbox for
// server errors (rate-limited per error signature so a hot loop can't flood
// the inbox), and persists rows for the owner console.

const OPS_EMAIL = process.env.OPS_ALERT_EMAIL ?? "support@glow-uk.com";
const WINDOW_MS = 15 * 60 * 1000;

const lastSent = new Map<string, number>();

async function persistError(
  err: Error,
  signature: string,
  context: Record<string, unknown>,
): Promise<void> {
  try {
    await supabaseService()
      .from("platform_errors")
      .insert({
        id: randomId("err"),
        signature,
        message: err.message.slice(0, 2000),
        stack: (err.stack ?? "").slice(0, 8000) || null,
        context,
        where: typeof context.where === "string" ? context.where : null,
      });
  } catch {
    // Table may not exist until migration 0044.
  }
}

export async function reportError(error: unknown, context: Record<string, unknown> = {}): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));
  const signature = `${err.name}:${err.message}`.slice(0, 200);

  console.error("[glow-error]", signature, JSON.stringify(context), err.stack ?? "");
  await persistError(err, signature, context);

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
      kind: "ops_error",
    });
  } catch {
    // Monitoring must never throw into the request path.
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
