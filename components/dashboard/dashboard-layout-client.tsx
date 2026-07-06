"use client";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { useDashboardAuth } from "@/hooks/use-dashboard-auth";
import { DASHBOARD_DATA_KEYS } from "@/lib/dashboard/page-loaders";
import { prefetchDashboardData } from "@/lib/dashboard/client-cache";
import { useEffect } from "react";

function DashboardAuthLoading() {
  return (
    <div className="min-h-screen bg-cream animate-pulse">
      <div className="h-16 border-b border-edge bg-surface/95" />
      <div className="container-page grid gap-6 py-6 lg:grid-cols-[220px_1fr]">
        <div className="card hidden h-96 lg:block" />
        <div className="space-y-4">
          <div className="h-8 w-48 rounded-lg bg-white/[0.06]" />
          <div className="card h-64" />
        </div>
      </div>
    </div>
  );
}

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  const { tech, admin, loading } = useDashboardAuth();

  useEffect(() => {
    if (!tech) return;
    for (const key of DASHBOARD_DATA_KEYS) {
      prefetchDashboardData(key);
    }
  }, [tech]);

  if (loading) return <DashboardAuthLoading />;
  if (!tech) return null;

  return <DashboardShell tech={tech} admin={admin}>{children}</DashboardShell>;
}
