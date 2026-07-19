"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { RemoteImage } from "@/components/ui/remote-image";
import { heroBrand, initials, onBrand, shade } from "@/lib/booking/brand";
import { categorySectionId, serviceSectionId } from "@/lib/booking/service-groups";
import { cn } from "@/lib/utils";

export type ServiceNavGroup = {
  id: string;
  title: string;
  services: { id: string; name: string }[];
};

const NAV = [
  { id: "gallery", label: "Gallery" },
  { id: "reviews", label: "Reviews" },
  { id: "hours", label: "Hours" },
] as const;

function scrollToId(id: string) {
  window.dispatchEvent(new CustomEvent("booking-navigate", { detail: { id } }));
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ServicesList({
  groups,
  onNavigate,
  className,
}: {
  groups: ServiceNavGroup[];
  onNavigate: (id: string) => void;
  className?: string;
}) {
  const multiCategory = groups.length > 1;

  return (
    <div className={className}>
      {groups.map((group) => (
        <div key={group.id} className="py-1">
          {multiCategory && (
            <button
              type="button"
              onClick={() => onNavigate(categorySectionId(group.id))}
              className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-ink transition hover:bg-white/[0.06]"
            >
              {group.title}
              <span className="ml-auto text-xs font-normal text-ink-faint">{group.services.length}</span>
            </button>
          )}
          <ul className={multiCategory ? "ml-2 border-l border-edge pl-2" : ""}>
            {group.services.map((service) => (
              <li key={service.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(serviceSectionId(service.id))}
                  className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-ink-soft transition hover:bg-white/[0.06] hover:text-ink"
                >
                  {service.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onNavigate("services")}
        className="mt-1 w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-ink-faint transition hover:bg-white/[0.06] hover:text-ink-soft"
      >
        View all treatments
      </button>
    </div>
  );
}

function ServicesDropdown({
  groups,
  onNavigate,
}: {
  groups: ServiceNavGroup[];
  onNavigate?: () => void;
}) {
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
    onNavigate?.();
    scrollToId(id);
  };

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
          <div className="max-h-[min(70vh,420px)] overflow-y-auto py-2 px-1">
            <ServicesList groups={groups} onNavigate={go} />
          </div>
        </div>
      )}
    </div>
  );
}

function MobileNav({
  brand,
  hasServices,
  serviceGroups,
  onClose,
}: {
  brand: string;
  hasServices: boolean;
  serviceGroups: ServiceNavGroup[];
  onClose: () => void;
}) {
  const [servicesOpen, setServicesOpen] = useState(false);

  const go = (id: string) => {
    onClose();
    scrollToId(id);
  };

  return (
    <nav className="flex flex-col gap-1 border-t border-edge bg-cream/98 px-4 py-4 backdrop-blur-md">
      {hasServices && serviceGroups.length > 0 && (
        <div className="rounded-xl border border-edge bg-surface/60">
          <button
            type="button"
            aria-expanded={servicesOpen}
            onClick={() => setServicesOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-ink"
          >
            Services
            <ChevronDown className={cn("h-4 w-4 text-ink-faint transition-transform", servicesOpen && "rotate-180")} />
          </button>
          {servicesOpen && (
            <div className="max-h-[40vh] overflow-y-auto border-t border-edge px-2 pb-2">
              <ServicesList groups={serviceGroups} onNavigate={go} />
            </div>
          )}
        </div>
      )}

      {hasServices && serviceGroups.length === 0 && (
        <button
          type="button"
          onClick={() => go("services")}
          className="rounded-xl px-4 py-3 text-left text-sm font-medium text-ink-soft transition hover:bg-white/[0.06] hover:text-ink"
        >
          Services
        </button>
      )}

      {NAV.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => go(item.id)}
          className="rounded-xl px-4 py-3 text-left text-sm font-medium text-ink-soft transition hover:bg-white/[0.06] hover:text-ink"
        >
          {item.label}
        </button>
      ))}

      {hasServices && (
        <button
          type="button"
          onClick={() => go("services")}
          className="mt-2 rounded-xl px-4 py-3 text-sm font-semibold transition hover:brightness-110"
          style={{ backgroundColor: brand, color: onBrand(brand) }}
        >
          Book now
        </button>
      )}
    </nav>
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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const scrollTo = (id: string) => scrollToId(id);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition duration-300",
        scrolled || menuOpen
          ? "border-edge bg-cream/95 shadow-sm backdrop-blur-md"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl ring-2 ring-white/10"
            style={{ background: `linear-gradient(135deg, ${heroBrand(brand)}, ${shade(heroBrand(brand), -24)})` }}
          >
            {profileUrl ? (
              // Contain, not cover: logos with text must never be cut off, and
              // the brand gradient behind fills any letterboxing.
              <RemoteImage src={profileUrl} alt={businessName} fill fit="contain" />
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
              className="ml-2 rounded-xl px-4 py-2 text-sm font-semibold transition hover:brightness-110"
              style={{ backgroundColor: brand, color: onBrand(brand) }}
            >
              Book now
            </button>
          )}
        </nav>

        <button
          type="button"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-xl border border-edge bg-surface/80 text-ink md:hidden"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen && (
        <MobileNav
          brand={brand}
          hasServices={hasServices}
          serviceGroups={serviceGroups}
          onClose={() => setMenuOpen(false)}
        />
      )}
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
