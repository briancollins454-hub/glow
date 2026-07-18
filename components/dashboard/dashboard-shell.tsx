"use client";

import Link from "next/link";
import { CalendarHeart, ExternalLink, LifeBuoy, Lightbulb, LogOut } from "lucide-react";
import type { Tech } from "@/lib/db/types";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { InstallPrompt } from "@/components/dashboard/install-prompt";
import { PrefetchDashboardRoutes } from "@/components/dashboard/prefetch-dashboard-routes";
import { useUnreadMessages } from "@/components/dashboard/unread-messages-badge";
import { logoutAction } from "@/app/(auth)/actions";
import { invalidateDashboardAuth } from "@/hooks/use-dashboard-auth";
import { clearDashboardCache } from "@/lib/dashboard/client-cache";

export function DashboardShell({
  tech,
  admin,
  role = "owner",
  staffName,
  children,
}: {
  tech: Tech;
  admin: boolean;
  role?: "owner" | "staff";
  staffName?: string | null;
  children: React.ReactNode;
}) {
  const unread = useUnreadMessages();

  return (
    <div className="min-h-screen bg-cream">
      <PrefetchDashboardRoutes />
      <header className="sticky top-0 z-20 border-b border-edge bg-surface/95 max-lg:backdrop-blur-none lg:bg-surface/80 lg:backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/dashboard" prefetch className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
              <CalendarHeart className="h-4.5 w-4.5 h-[18px] w-[18px]" />
            </span>
            <span className="font-display text-lg font-semibold">Glow</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/feedback"
              prefetch
              className="flex items-center gap-1.5 rounded-xl border border-brand-500/40 bg-brand-500/10 px-3 py-2 text-sm font-medium text-brand-300 hover:bg-brand-500/20"
            >
              <Lightbulb className="h-4 w-4" />
              <span className="hidden sm:inline">Share an idea</span>
            </Link>
            <Link
              href="/dashboard/help"
              prefetch
              className="flex items-center gap-1.5 rounded-xl border border-edge px-3 py-2 text-sm font-medium text-ink-soft hover:bg-white/[0.06]"
            >
              <LifeBuoy className="h-4 w-4 text-brand-400" />
              <span className="hidden sm:inline">Help</span>
            </Link>
            <Link
              href={`/${tech.handle}`}
              target="_blank"
              className="hidden items-center gap-1.5 rounded-xl border border-edge px-3 py-2 text-sm text-ink-soft hover:bg-white/[0.06] sm:flex"
            >
              <ExternalLink className="h-4 w-4" /> View booking page
            </Link>
            <span className="hidden text-right text-sm sm:block">
              <span className="block font-medium leading-tight">{tech.businessName}</span>
              <span className="block text-xs text-ink-faint">
                {role === "staff" && staffName ? staffName : tech.email}
              </span>
            </span>
            <form
              action={logoutAction}
              onSubmit={() => {
                // Server-action redirects are soft navigations, so wipe the
                // in-memory identity/data caches or the next login would
                // briefly show this account.
                invalidateDashboardAuth();
                clearDashboardCache();
              }}
            >
              <button
                type="submit"
                className="grid h-9 w-9 place-items-center rounded-xl text-ink-soft hover:bg-white/[0.06]"
                title="Log out"
              >
                <LogOut className="h-4.5 w-4.5 h-[18px] w-[18px]" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="container-page grid gap-6 py-6 pb-28 lg:grid-cols-[220px_1fr] lg:pb-6">
        <aside className="min-w-0 lg:sticky lg:top-20 lg:h-fit">
          <div className="card max-w-full lg:py-1">
            <SidebarNav unread={unread} admin={admin} role={role} />
          </div>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>

      <MobileNav unread={unread} />
      <InstallPrompt />
    </div>
  );
}
