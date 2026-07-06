"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";

export function StickyBookCta({
  minPriceLabel,
  brand,
  serviceCount,
}: {
  minPriceLabel: string;
  brand: string;
  serviceCount: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.querySelector("header");
    if (!hero) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-40px 0px 0px 0px" },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  if (serviceCount === 0) return null;

  const scrollToServices = () => {
    document.getElementById("services")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-cream/95 px-4 py-3 pb-safe backdrop-blur-md transition duration-300 lg:hidden ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
      }`}
    >
      <button
        type="button"
        onClick={scrollToServices}
        className="mx-auto flex w-full max-w-2xl items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white shadow-soft transition active:scale-[0.98]"
        style={{ backgroundColor: brand }}
      >
        <Calendar className="h-4 w-4" />
        Book from {minPriceLabel}
      </button>
    </div>
  );
}
