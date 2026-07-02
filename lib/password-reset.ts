import { createHash, randomBytes } from "node:crypto";
import { supabaseService } from "@/lib/supabase/service";
import { getTechByEmail, getTechByResetTokenHash, updateTech } from "@/lib/db/queries";
import { sendEmail, brandedEmail } from "@/lib/email";
import type { Tech } from "@/lib/db/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issue a reset token and email the link. Silently no-ops for unknown emails
 * so the form never reveals whether an account exists.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const sb = supabaseService();
  const tech = await getTechByEmail(sb, email);
  if (!tech) return;

  const token = randomBytes(32).toString("hex");
  await updateTech(sb, tech.id, {
    resetTokenHash: hash(token),
    resetTokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
  });

  const url = `${APP_URL}/reset/${token}`;
  const html = brandedEmail({
    brand: "#db2777",
    businessName: "Glow",
    heading: "Reset your password",
    bodyHtml:
      "We received a request to reset your Glow password. Click the button below to choose a new one. This link works once and expires in 1 hour.<br/><br/>If you didn't ask for this, you can safely ignore this email.",
    buttonLabel: "Choose a new password",
    buttonUrl: url,
  });
  await sendEmail({
    to: tech.email,
    subject: "Reset your Glow password",
    html,
    text: `Reset your Glow password: ${url}\nThis link works once and expires in 1 hour. If you didn't ask for this, ignore this email.`,
    idempotencyKey: `pwreset/${tech.id}/${Date.now()}`,
  });
}

/** Return the tech for a valid, unexpired token; null otherwise. */
export async function validateResetToken(token: string): Promise<Tech | null> {
  if (!token || token.length < 32) return null;
  const sb = supabaseService();
  const tech = await getTechByResetTokenHash(sb, hash(token));
  if (!tech || !tech.resetTokenExpiresAt) return null;
  if (new Date(tech.resetTokenExpiresAt).getTime() < Date.now()) return null;
  return tech;
}

/** Set the new password and burn the token. Returns false if token invalid. */
export async function completePasswordReset(token: string, newPassword: string): Promise<boolean> {
  const tech = await validateResetToken(token);
  if (!tech || !tech.authUserId) return false;
  const sb = supabaseService();
  const { error } = await sb.auth.admin.updateUserById(tech.authUserId, {
    password: newPassword,
  });
  if (error) return false;
  await updateTech(sb, tech.id, { resetTokenHash: null, resetTokenExpiresAt: null });
  return true;
}
