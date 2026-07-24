"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard/admin", label: "Overview", exact: true },
  { href: "/dashboard/admin/traffic", label: "Traffic" },
  { href: "/dashboard/admin/accounts", label: "Accounts" },
  { href: "/dashboard/admin/partners", label: "Partners" },
  { href: "/dashboard/admin/revenue", label: "Revenue" },
  { href: "/dashboard/admin/ops", label: "Operations" },
  { href: "/dashboard/admin/support", label: "Support" },
  { href: "/dashboard/admin/support-import", label: "Import" },
  { href: "/dashboard/admin/client-name-cleanup", label: "Name cleanup" },
];

export function OwnerNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 rounded-xl border border-edge bg-cream p-1">
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(link.href + "/");
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              active ? "bg-brand-600 text-white" : "text-ink-soft hover:bg-fill-hover hover:text-ink",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
