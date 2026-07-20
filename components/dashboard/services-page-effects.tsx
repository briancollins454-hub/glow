"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { serviceSectionId } from "@/lib/booking/service-groups";

/** Scroll to the saved service and show a brief confirmation or error banner. */
export function ServicesPageEffects() {
  const searchParams = useSearchParams();
  const open = searchParams.get("open");
  const saved = searchParams.get("saved") === "1";
  const photoerr = searchParams.get("photoerr");

  useEffect(() => {
    if (!(saved || photoerr) || !open) return;
    const timer = window.setTimeout(() => {
      document.getElementById(serviceSectionId(open))?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [saved, photoerr, open]);

  if (photoerr) {
    return (
      <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-text">
        {photoerr === "size"
          ? "That photo is too large. Please choose an image under 8MB."
          : "Photo upload failed. Use a JPG, PNG or WebP image and try again."}
      </div>
    );
  }

  if (!saved) return null;

  return (
    <div className="flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      Changes saved.
    </div>
  );
}
