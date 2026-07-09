"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar } from "lucide-react";
import { RemoteImage } from "@/components/ui/remote-image";
import { initials, shade } from "@/lib/booking/brand";
import { cn } from "@/lib/utils";

const NAV = [
  { id: "services", label: "Services" },
  { id: "work", label: "Work" },
  { id: "reviews", label: "Reviews" },
  { id: "hours", label: "Hours" },
] as const;

export function BookingHeader({
  businessName,
  brand,
  profileUrl,
  hasServices,
}: {
  businessName: string;
  brand: string;
  profileUrl?: string;
  hasServices: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
