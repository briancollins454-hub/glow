"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { serviceSectionId } from "@/lib/booking/service-groups";

/** Scroll to the saved service and show a brief confirmation banner. */
export function ServicesPageEffects() {
  const searchParams = useSearchParams();
  const open = searchParams.get("open");
  const saved = searchParams.get("saved") === "1";

  useEffect(() => {
    if (!saved || !open) return;
    const timer = window.setTimeout(() => {
      document.getElementById(serviceSectionId(open))?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [saved, open]);

  if (!saved) return null;

  return (
    <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      Changes saved.
    </div>
  );
}
