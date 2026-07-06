"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DASHBOARD_DATA_KEYS } from "@/lib/dashboard/page-loaders";
import { prefetchDashboardData } from "@/lib/dashboard/client-cache";

/** Warm JSON caches for every dashboard page on first load. */
export function PrefetchDashboardRoutes() {
  const router = useRouter();

  useEffect(() => {
    for (const key of DASHBOARD_DATA_KEYS) {
      prefetchDashboardData(key);
    }
    const routes = [
      "/dashboard",
      "/dashboard/bookings",
      "/dashboard/messages",
      "/dashboard/clients",
      "/dashboard/services",
      "/dashboard/availability",
      "/dashboard/forms",
      "/dashboard/reminders",
      "/dashboard/reviews",
      "/dashboard/reports",
      "/dashboard/payments",
      "/dashboard/billing",
      "/dashboard/import",
      "/dashboard/settings",
      "/dashboard/help",
      "/dashboard/feedback",
    ];
    for (const href of routes) {
      router.prefetch(href);
    }
  }, [router]);

  return null;
}
