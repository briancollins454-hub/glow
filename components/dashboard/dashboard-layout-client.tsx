"use client";

import { usePathname } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DashboardPaywall } from "@/components/dashboard/dashboard-paywall";
import { DashboardTheme } from "@/components/theme/theme-providers";
import { useDashboardAuth } from "@/hooks/use-dashboard-auth";
import { isLive } from "@/lib/subscriptions";
import { DASHBOARD_DATA_KEYS } from "@/lib/dashboard/page-loaders";
import { prefetchDashboardData } from "@/lib/dashboard/client-cache";
import { useEffect } from "react";

const PAYWALL_ALLOWED_PREFIXES = ["/dashboard/billing", "/dashboard/settings"];

function DashboardAuthLoading() {
  return (
    <div className="min-h-screen bg-cream animate-pulse">
      <div className="h-16 border-b border-edge bg-surface/95" />
      <div className="container-page grid gap-6 py-6 lg:grid-cols-[220px_1fr]">
        <div className="card hidden h-96 lg:block" />
        <div className="space-y-4">
          <div className="h-8 w-48 rounded-lg bg-fill-hover" />
          <div className="card h-64" />
        </div>
      </div>
    </div>
  );
}

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  const { tech, admin, role, staff, loading } = useDashboardAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!tech) return;
    for (const key of DASHBOARD_DATA_KEYS) {
      prefetchDashboardData(key);
    }
  }, [tech]);

  if (loading) return <DashboardAuthLoading />;
  if (!tech) return null;

  const isTester = tech.signupOffer === "tester";
  const mustPay = !admin && !isLive(tech) && !isTester;
  const onAllowedRoute = PAYWALL_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`),
  );

  return (
    <>
      <DashboardTheme preference={tech.dashboardTheme} />
      <DashboardShell tech={tech} admin={admin} role={role} staffName={staff?.name}>
        {mustPay && !onAllowedRoute ? <DashboardPaywall tech={tech} /> : children}
      </DashboardShell>
    </>
  );
}
