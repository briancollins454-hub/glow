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

/** Plain-text body for a bulk owner nudge. */
export function ownerNudgeBody(name: string, note: string): string {
  return `Hi ${name},\n\n${note.trim()}\n\nBrian`;
}

/** Escape user-typed note content for a `<pre>` HTML email body. */
export function escapeForPre(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
