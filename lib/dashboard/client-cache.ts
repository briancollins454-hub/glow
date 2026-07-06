type Entry<T> = { data: T; at: number };

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export const DASHBOARD_CACHE_MS = 60_000;

export function readDashboardCache<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit || Date.now() - hit.at > DASHBOARD_CACHE_MS) return null;
  return hit.data as T;
}

export function writeDashboardCache<T>(key: string, data: T) {
  store.set(key, { data, at: Date.now() });
}

export function clearDashboardCache(key?: string) {
  if (key) store.delete(key);
  else store.clear();
}

export async function fetchDashboardData<T>(key: string): Promise<T> {
  const cached = readDashboardCache<T>(key);
  if (cached) return cached;

  if (!inflight.has(key)) {
    inflight.set(
      key,
      fetch(`/api/dashboard/data/${key}`, { credentials: "same-origin" })
        .then(async (r) => {
          if (r.status === 401) {
            window.location.href = "/login";
            throw new Error("unauthorized");
          }
          if (!r.ok) throw new Error(`Failed to load ${key}`);
          return r.json() as Promise<T>;
        })
        .then((data) => {
          writeDashboardCache(key, data);
          return data;
        })
        .finally(() => {
          inflight.delete(key);
        }),
    );
  }
  return inflight.get(key)! as Promise<T>;
}

export function prefetchDashboardData(key: string) {
  if (readDashboardCache(key) || inflight.has(key)) return;
  void fetchDashboardData(key).catch(() => {});
}
