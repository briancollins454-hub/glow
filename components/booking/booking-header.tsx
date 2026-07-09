"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Calendar, ChevronDown } from "lucide-react";
import { RemoteImage } from "@/components/ui/remote-image";
import { initials, shade } from "@/lib/booking/brand";
import { categorySectionId, serviceSectionId } from "@/lib/booking/service-groups";
import { cn } from "@/lib/utils";

export type ServiceNavGroup = {
  id: string;
  title: string;
  services: { id: string; name: string }[];
};

const NAV = [
  { id: "work", label: "Work" },
  { id: "reviews", label: "Reviews" },
  { id: "hours", label: "Hours" },
] as const;

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ServicesDropdown({ groups }: { groups: ServiceNavGroup[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (id: string) => {
    setOpen(false);
    scrollToId(id);
  };

  const multiCategory = groups.length > 1;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition",
          open ? "bg-white/[0.08] text-ink" : "text-ink-soft hover:bg-white/[0.06] hover:text-ink",
        )}
      >
        Services
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-edge bg-surface shadow-card">
          <div className="max-h-[min(70vh,420px)] overflow-y-auto py-2">
            {groups.map((group) => (
              <div key={group.id} className="px-2 py-1">
                {multiCategory && (
                  <button
                    type="button"
                    onClick={() => go(categorySectionId(group.id))}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink transition hover:bg-white/[0.06]"
                  >
                    {group.title}
                    <span className="ml-auto text-xs font-normal text-ink-faint">
                      {group.services.length}
                    </span>
                  </button>
                )}
                <ul className={multiCategory ? "ml-1 border-l border-edge pl-2" : ""}>
                  {group.services.map((service) => (
                    <li key={service.id}>
                      <button
                        type="button"
                        onClick={() => go(serviceSectionId(service.id))}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink-soft transition hover:bg-white/[0.06] hover:text-ink"
                      >
                        {service.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-edge p-2">
            <button
              type="button"
              onClick={() => go("services")}
              className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-ink-faint transition hover:bg-white/[0.06] hover:text-ink-soft"
            >
              View all treatments
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function BookingHeader({
  businessName,
  brand,
  profileUrl,
  hasServices,
  serviceGroups = [],
}: {
  businessName: string;
  brand: string;
  profileUrl?: string;
  hasServices: boolean;
  serviceGroups?: ServiceNavGroup[];
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => scrollToId(id);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition duration-300",
        scrolled
          ? "border-edge bg-cream/95 shadow-sm backdrop-blur-md"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl ring-2 ring-white/10"
            style={{ background: `linear-gradient(135deg, ${brand}, ${shade(brand, -24)})` }}
          >
            {profileUrl ? (
              <RemoteImage src={profileUrl} alt={businessName} fill fit="cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-display text-sm font-semibold text-white">
                {initials(businessName)}
              </span>
            )}
          </div>
          <p className="truncate font-display text-base font-semibold text-ink sm:text-lg">
            {businessName}
          </p>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {hasServices && serviceGroups.length > 0 ? (
            <ServicesDropdown groups={serviceGroups} />
          ) : hasServices ? (
            <button
              type="button"
              onClick={() => scrollTo("services")}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-white/[0.06] hover:text-ink"
            >
              Services
            </button>
          ) : null}
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollTo(item.id)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-white/[0.06] hover:text-ink"
            >
              {item.label}
            </button>
          ))}
          {hasServices && (
            <button
              type="button"
              onClick={() => scrollTo("services")}
              className="ml-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
              style={{ backgroundColor: brand }}
            >
              Book now
            </button>
          )}
        </nav>

        {hasServices && (
          <button
            type="button"
            onClick={() => scrollTo("services")}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-white md:hidden"
            style={{ backgroundColor: brand }}
          >
            <Calendar className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  );
}

/** Compact header when client is in the booking flow. */
export function BookingFlowHeader({
  businessName,
  handle,
}: {
  businessName: string;
  handle: string;
  brand?: string;
}) {
  return (
    <header className="border-b border-edge bg-cream/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href={`/${handle}`} className="font-display text-base font-semibold text-ink hover:text-brand-300">
          {businessName}
        </Link>
        <Link
          href={`/${handle}`}
          className="text-sm font-medium text-ink-soft hover:text-ink"
        >
          Back to page
        </Link>
      </div>
    </header>
  );
}
