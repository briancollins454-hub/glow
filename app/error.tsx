"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[glow-client-error]", error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-4">
      <div className="card max-w-md p-8 text-center">
        <h1 className="font-display text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Sorry about that - it's been logged on our side. Try again, and if it keeps happening
          email support@glow-uk.com.
        </p>
        {error.digest && <p className="mt-2 text-xs text-ink-faint">Reference: {error.digest}</p>}
        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    </div>
  );
}
