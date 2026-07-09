"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ApproveDoneRedirect({
  bookingId,
  enabled,
}: {
  bookingId: string;
  enabled: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const t = window.setTimeout(() => {
      router.push(`/dashboard/bookings/${bookingId}`);
    }, 4000);
    return () => window.clearTimeout(t);
  }, [bookingId, enabled, router]);

  if (!enabled) return null;

  return (
    <p className="text-center text-xs text-ink-faint">
      Taking you to the dashboard in a few seconds…
    </p>
  );
}
