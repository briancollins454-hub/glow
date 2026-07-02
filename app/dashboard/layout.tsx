import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarHeart, ExternalLink, LogOut } from "lucide-react";
import { getDashboardContext } from "@/lib/auth/session";
import { unreadCountForTech } from "@/lib/db/queries";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { logoutAction } from "@/app/(auth)/actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getDashboardContext();
  if (!ctx) redirect("/login");
  const { sb, tech } = ctx;
  const unread = await unreadCountForTech(sb, tech.id);

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-20 border-b border-edge bg-surface/80 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
              <CalendarHeart className="h-4.5 w-4.5 h-[18px] w-[18px]" />
            </span>
            <span className="font-display text-lg font-semibold">Glow</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href={`/${tech.handle}`}
              target="_blank"
              className="hidden items-center gap-1.5 rounded-xl border border-edge px-3 py-2 text-sm text-ink-soft hover:bg-white/[0.06] sm:flex"
            >
              <ExternalLink className="h-4 w-4" /> View booking page
            </Link>
            <span className="hidden text-right text-sm sm:block">
              <span className="block font-medium leading-tight">
                {tech.businessName}
              </span>
              <span className="block text-xs text-ink-faint">{tech.email}</span>
            </span>
            <form action={logoutAction}>
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

      <div className="container-page grid gap-6 py-6 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:h-fit">
          <div className="card lg:py-1">
            <SidebarNav unread={unread} />
          </div>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
