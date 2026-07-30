"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard/admin", label: "Overview", exact: true },
  { href: "/dashboard/admin/search", label: "Search" },
  { href: "/dashboard/admin/traffic", label: "Traffic" },
  { href: "/dashboard/admin/accounts", label: "Accounts" },
  { href: "/dashboard/admin/worklists", label: "Worklists" },
  { href: "/dashboard/admin/outbound", label: "Outbound" },
  { href: "/dashboard/admin/broadcast", label: "Broadcast" },
  { href: "/dashboard/admin/controls", label: "Controls" },
  { href: "/dashboard/admin/alerts", label: "Alerts" },
  { href: "/dashboard/admin/runbooks", label: "Runbooks" },
  { href: "/dashboard/admin/events", label: "Events" },
  { href: "/dashboard/admin/adoption", label: "Adoption" },
  { href: "/dashboard/admin/money", label: "Money" },
  { href: "/dashboard/admin/revenue", label: "Revenue" },
  { href: "/dashboard/admin/economics", label: "Economics" },
  { href: "/dashboard/admin/attribution", label: "Attribution" },
  { href: "/dashboard/admin/referrals", label: "Referrals" },
  { href: "/dashboard/admin/feedback", label: "Feedback" },
  { href: "/dashboard/admin/deliverability", label: "Deliverability" },
  { href: "/dashboard/admin/conflicts", label: "Conflicts" },
  { href: "/dashboard/admin/data-quality", label: "Data quality" },
  { href: "/dashboard/admin/webhooks", label: "Webhooks" },
  { href: "/dashboard/admin/errors", label: "Errors" },
  { href: "/dashboard/admin/templates", label: "Templates" },
  { href: "/dashboard/admin/flags", label: "Flags" },
  { href: "/dashboard/admin/audit", label: "Audit" },
  { href: "/dashboard/admin/gdpr", label: "GDPR" },
  { href: "/dashboard/admin/internal", label: "Internal" },
  { href: "/dashboard/admin/offers", label: "Signup offer" },
  { href: "/dashboard/admin/partners", label: "Partners" },
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
