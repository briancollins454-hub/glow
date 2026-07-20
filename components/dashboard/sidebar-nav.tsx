"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  UsersRound,
  Scissors,
  Clock,
  BellRing,
  Star,
  BarChart3,
  CreditCard,
  Wallet,
  ClipboardList,
  MessageSquare,
  FolderInput,
  Settings,
  LifeBuoy,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/bookings", label: "Calendar", icon: CalendarDays },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/clients", label: "Clients", icon: Users },
  { href: "/dashboard/services", label: "Services", icon: Scissors, ownerOnly: true },
  { href: "/dashboard/availability", label: "Opening hours", icon: Clock, ownerOnly: true },
  { href: "/dashboard/team", label: "Team", icon: UsersRound },
  { href: "/dashboard/forms", label: "Forms", icon: ClipboardList },
  { href: "/dashboard/reminders", label: "Reminders", icon: BellRing },
  { href: "/dashboard/reviews", label: "Reviews", icon: Star },
  { href: "/dashboard/reports", label: "Income", icon: BarChart3, ownerOnly: true },
  { href: "/dashboard/payments", label: "Get paid", icon: Wallet, ownerOnly: true },
  { href: "/dashboard/billing", label: "My plan", icon: CreditCard, ownerOnly: true },
  { href: "/dashboard/import", label: "Move to Glow", icon: FolderInput, ownerOnly: true },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, ownerOnly: true },
  { href: "/dashboard/help", label: "Help", icon: LifeBuoy },
];

export function SidebarNav({
  unread = 0,
  admin = false,
  role = "owner",
}: {
  unread?: number;
  admin?: boolean;
  role?: "owner" | "staff";
}) {
  const pathname = usePathname();
  const visible = items.filter((item) => role === "owner" || !item.ownerOnly);
  const navItems = admin
    ? [...visible, { href: "/dashboard/admin", label: "Owner", icon: Crown, exact: false }]
    : visible;
  return (
    <nav className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-visible lg:p-3">
      {navItems.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition lg:shrink",
              active
                ? "bg-brand-600 text-white shadow-sm"
                : "text-ink-soft hover:bg-fill-hover hover:text-ink",
            )}
          >
            <item.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
            {item.label}
            {item.href === "/dashboard/messages" && unread > 0 && (
              <span className={cn(
                "ml-auto grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 text-xs font-semibold",
                active ? "bg-white/25 text-white" : "bg-brand-600 text-white",
              )}>
                {unread}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
