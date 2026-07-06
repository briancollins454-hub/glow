"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearDashboardCache,
  fetchDashboardData,
  readDashboardCache,
} from "@/lib/dashboard/client-cache";

export function useDashboardQuery<T>(key: string) {
  const [data, setData] = useState<T | null>(() => readDashboardCache<T>(key));
  const [isLoading, setIsLoading] = useState(!readDashboardCache<T>(key));
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
    const cached = readDashboardCache<T>(key);
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
