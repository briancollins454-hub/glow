"use client";

import Link from "next/link";
import { X } from "lucide-react";

export function RetestBookingNotice({
  businessName,
  bookUrl,
}: {
  businessName: string;
  bookUrl?: string;
}) {
  return (
    <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      <div className="flex items-start justify-between gap-3">
        <p>
          <strong className="font-semibold text-amber-50">Patch test needed.</strong>{" "}
          {businessName} has changed products and you need a quick re-test before your next treatment.
          {bookUrl ? (
            <>
              {" "}
              <Link href={bookUrl} className="font-medium underline hover:text-white">
                Book your patch test and treatment now
              </Link>
              .
            </>
          ) : (
            " Pick a treatment below to book your patch test and appointment together."
          )}
        </p>
        <button
          type="button"
          onClick={(e) => (e.currentTarget.closest("div")?.parentElement?.remove())}
          className="shrink-0 rounded-lg p-1 text-amber-200/80 hover:bg-amber-500/20"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
