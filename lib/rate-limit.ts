import { headers } from "next/headers";

// Fixed-window rate limiter, in-memory per server instance. On serverless this
// is per-instance rather than global, which still blunts abuse (each instance
// enforces the cap) without needing Redis or another paid dependency.

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();
const MAX_KEYS = 10_000;

/** Pure core, exported for tests. Returns true when the call is allowed. */
export function checkLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): boolean {
  // Opportunistic cleanup so the map can't grow without bound.
  if (windows.size > MAX_KEYS) {
    for (const [k, w] of windows) {
      if (w.resetAt <= now) windows.delete(k);
    }
    if (windows.size > MAX_KEYS) windows.clear();
  }

  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  existing.count++;
  return existing.count <= limit;
}

/** Best-effort caller IP from proxy headers (Vercel sets x-forwarded-for). */
export async function callerIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Rate limit a named public action by caller IP.
 * Returns true when allowed, false when the caller should be turned away.
 */
export async function rateLimit(
  action: string,
  { limit, windowMinutes }: { limit: number; windowMinutes: number },
): Promise<boolean> {
  const ip = await callerIp();
  return checkLimit(`${action}:${ip}`, limit, windowMinutes * 60 * 1000);
}
