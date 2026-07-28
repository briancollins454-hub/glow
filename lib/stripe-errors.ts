/** Turn a Stripe (or unknown) error into a short message safe to show a tech. */
export function stripeErrorMessage(
  err: unknown,
  fallback = "Something went wrong with Stripe. Please try again.",
): string {
  if (!err) return fallback;
  if (typeof err === "string") {
    const t = err.trim();
    return t || fallback;
  }
  if (typeof err === "object") {
    const e = err as {
      message?: unknown;
      raw?: { message?: unknown };
      userMessage?: unknown;
    };
    for (const candidate of [e.userMessage, e.message, e.raw?.message]) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
  }
  return fallback;
}
