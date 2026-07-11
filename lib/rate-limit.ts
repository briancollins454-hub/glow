import { headers } from "next/headers";

/**
 * In-memory sliding-window rate limiter keyed by IP + route name.
 * Per-instance only (fine for low traffic on serverless). Upgrade path:
 * swap the body of rateLimit() for Upstash Ratelimit while keeping the same
 * { ok: boolean } interface.
 */

type TimestampMs = number;

interface Bucket {
  hits: TimestampMs[];
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

function pruneExpired(bucket: Bucket, windowStart: TimestampMs): void {
  while (bucket.hits.length > 0 && bucket.hits[0]! <= windowStart) {
    bucket.hits.shift();
  }
}

function cleanupStaleBuckets(now: TimestampMs, windowMs: number): void {
  if (buckets.size <= MAX_KEYS) return;
  const cutoff = now - windowMs;
  for (const [key, bucket] of buckets) {
    pruneExpired(bucket, cutoff);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
  if (buckets.size > MAX_KEYS) buckets.clear();
}

/** Pure core for tests. Sliding window: count hits within (now - windowMs, now]. */
export function checkLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): { ok: boolean } {
  cleanupStaleBuckets(now, windowMs);
  const windowStart = now - windowMs;
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }
  pruneExpired(bucket, windowStart);
  if (bucket.hits.length >= limit) {
    return { ok: false };
  }
  bucket.hits.push(now);
  return { ok: true };
}

/** Best-effort caller IP from proxy headers (Vercel sets x-forwarded-for). */
export async function callerIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "unknown";
}

/**
 * Rate limit a named public route by caller IP.
 * `windowMs` defaults to 60_000 (one minute) when omitted.
 */
export async function rateLimit(
  routeName: string,
  opts: { limit: number; windowMs?: number; windowMinutes?: number },
): Promise<{ ok: boolean }> {
  const windowMs =
    opts.windowMs ??
    (opts.windowMinutes != null ? opts.windowMinutes * 60 * 1000 : 60_000);
  const ip = await callerIp();
  return checkLimit(`${routeName}:${ip}`, opts.limit, windowMs);
}
