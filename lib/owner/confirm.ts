/**
 * Forgiving confirm checks for owner-console destructive actions.
 * Mobile keyboards often capitalise the first letter or add trailing space.
 */

export function isConfirmed(formData: FormData, expected = "yes"): boolean {
  return (
    String(formData.get("confirm") ?? "")
      .trim()
      .toLowerCase() === expected.trim().toLowerCase()
  );
}

const NUDGE_SUBJECTS: Record<string, string> = {
  setup_help: "Need a hand getting set up?",
  go_live: "Ready to go live?",
  win_back: "We would love you back",
  trial_nudge: "Your Glow trial",
};

/** Subject line for a bulk owner nudge by kind. */
export function ownerNudgeSubject(kind: string): string {
  return NUDGE_SUBJECTS[kind] ?? NUDGE_SUBJECTS.setup_help!;
}

/**
 * Title-case the first word of a name for email greetings.
 * Falls back: name → businessName → "there".
 */
export function ownerGreetingName(
  name: string | null | undefined,
  businessName?: string | null,
): string {
  const raw = String(name || businessName || "").trim();
  if (!raw) return "there";
  const first = raw.split(/\s+/)[0]!;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** Plain-text body for a bulk owner nudge. */
export function ownerNudgeBody(name: string, note: string): string {
  return `Hi ${name},\n\n${note.trim()}\n\nBrian`;
}

/** Escape user content for HTML email bodies. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** @deprecated use escapeHtml */
export const escapeForPre = escapeHtml;

/** HTML body: greeting paragraph + note (newlines → `<br/>`). */
export function ownerNudgeBodyHtml(greetingName: string, note: string): string {
  const safeName = escapeHtml(greetingName);
  const safeNote = escapeHtml(note.trim()).replace(/\r\n/g, "\n").replace(/\n/g, "<br/>");
  return `<p>Hi ${safeName},</p><p>${safeNote}</p>`;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** CTA button for a bulk nudge, driven by kind. */
export function ownerNudgeCta(kind: string): { buttonLabel: string; buttonUrl: string } {
  if (kind === "trial_nudge") {
    return { buttonLabel: "See your plan", buttonUrl: `${APP_URL}/dashboard/billing` };
  }
  if (kind === "win_back") {
    return { buttonLabel: "Come back to Glow", buttonUrl: `${APP_URL}/dashboard` };
  }
  // setup_help, go_live, and unknown kinds
  return { buttonLabel: "Open your dashboard", buttonUrl: `${APP_URL}/dashboard` };
}

/**
 * Safe return path for bulk actions. Only `/dashboard/admin/accounts` (with
 * optional query) is allowed — anything else falls back to the list root.
 * Sets `key=value` (err or ok) and clears the other flash key.
 */
export function accountsReturnWith(returnTo: unknown, key: "err" | "ok", value: string): string {
  const raw = String(returnTo ?? "").trim();
  let path = "/dashboard/admin/accounts";
  let search = "";
  if (raw.startsWith("/dashboard/admin/accounts")) {
    const q = raw.indexOf("?");
    const pathname = q >= 0 ? raw.slice(0, q) : raw;
    // Only the list root preserves filters; detail URLs fall back.
    if (pathname === "/dashboard/admin/accounts") {
      path = pathname;
      search = q >= 0 ? raw.slice(q + 1) : "";
    }
  } else if (raw.startsWith("?") || (raw.length > 0 && !raw.startsWith("/") && raw.includes("="))) {
    search = raw.startsWith("?") ? raw.slice(1) : raw;
  }
  const params = new URLSearchParams(search);
  params.delete("err");
  params.delete("ok");
  params.set(key, value);
  return `${path}?${params.toString()}`;
}

/** Err redirect that keeps the current accounts list filters. */
export function accountsReturnPath(returnTo: unknown, err: string): string {
  return accountsReturnWith(returnTo, "err", err);
}
