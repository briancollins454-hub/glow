"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearDashboardCache,
  fetchDashboardData,
  readDashboardCache,
} from "@/lib/dashboard/client-cache";

function shouldBustDashboardCache(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("saved") === "1";
}

function readInitialCache<T>(key: string): T | null {
  if (shouldBustDashboardCache()) return null;
  return readDashboardCache<T>(key);
}

export function useDashboardQuery<T>(key: string) {
  const [data, setData] = useState<T | null>(() => readInitialCache<T>(key));
  const [isLoading, setIsLoading] = useState(() => !readInitialCache<T>(key));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    clearDashboardCache(key);
    setIsLoading(true);
    setError(null);
    fetchDashboardData<T>(key)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setIsLoading(false));
  }, [key]);

  useEffect(() => {
    let cancelled = false;
    const bustCache = shouldBustDashboardCache();
    if (bustCache) clearDashboardCache(key);

    const cached = bustCache ? null : readDashboardCache<T>(key);
    if (cached) {
      setData(cached);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetchDashboardData<T>(key)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { data, isLoading, error, refresh };
}
