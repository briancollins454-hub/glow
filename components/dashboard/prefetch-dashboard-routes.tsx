"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DASHBOARD_ROUTES } from "@/lib/dashboard/routes";

/** Warm the Next.js router cache for every dashboard page on first load. */
export function PrefetchDashboardRoutes() {
  const router = useRouter();

  useEffect(() => {
    for (const href of DASHBOARD_ROUTES) {
      router.prefetch(href);
    }
  }, [router]);

  return null;
}
