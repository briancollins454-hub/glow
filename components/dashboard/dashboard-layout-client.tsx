"use client";

import { usePathname } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DashboardPaywall } from "@/components/dashboard/dashboard-paywall";
import { useDashboardAuth } from "@/hooks/use-dashboard-auth";
import { isLive } from "@/lib/subscriptions";
import { DASHBOARD_DATA_KEYS } from "@/lib/dashboard/page-loaders";
import { prefetchDashboardData } from "@/lib/dashboard/client-cache";
import { useEffect } from "react";

// Routes a not-yet-paid tech can still reach: billing (to subscribe) and the
// account settings page (so they can manage/close the account). Everything else
// is gated behind an active plan.
const PAYWALL_ALLOWED_PREFIXES = ["/dashboard/billing", "/dashboard/settings"];

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
  const pathname = usePathname();

  useEffect(() => {
    if (!tech) return;
    for (const key of DASHBOARD_DATA_KEYS) {
      prefetchDashboardData(key);
    }
  }, [tech]);

  if (loading) return <DashboardAuthLoading />;
  if (!tech) return null;

  // Hard paywall: a tech that hasn't activated a plan can only reach billing
  // and account settings. Exempt: the owner (support access must never break),
  // live accounts (active/trialing/comped), and invited testers (the private
  // £1-link crowd helping test Glow).
  const isTester = tech.signupOffer === "tester";
  const mustPay = !admin && !isLive(tech) && !isTester;
  const onAllowedRoute = PAYWALL_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`),
  );

  return (
    <DashboardShell tech={tech} admin={admin}>
      {mustPay && !onAllowedRoute ? <DashboardPaywall tech={tech} /> : children}
    </DashboardShell>
  );
}
