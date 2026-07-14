"use client";

import { useEffect } from "react";
import { invalidateDashboardAuth } from "@/hooks/use-dashboard-auth";
import { clearDashboardCache } from "@/lib/dashboard/client-cache";

/**
 * Rendered on the auth pages (login/signup). Server-action redirects are soft
 * navigations, so the in-memory dashboard caches (identity + page data) from a
 * previous session survive a logout. Wipe them whenever someone reaches an
 * auth page, so the next login can never show the previous account's identity
 * or data.
 */
export function ClearSessionCache() {
  useEffect(() => {
    invalidateDashboardAuth();
    clearDashboardCache();
  }, []);
  return null;
}
