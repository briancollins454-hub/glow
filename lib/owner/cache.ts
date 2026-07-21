type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();

/**
 * Short in-memory TTL cache for heavy owner overview queries.
 * Per serverless instance only; UI shows "as of Xm ago" from generatedAt.
 */
export function cachedGet<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  const now = Date.now();
  if (hit && hit.expiresAt > now) return Promise.resolve(hit.value);
  return compute().then((value) => {
    store.set(key, { value, expiresAt: now + ttlMs });
    return value;
  });
}

export function cachedInvalidate(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
