"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** Fetches unread message count without blocking the dashboard shell. */
export function useUnreadMessages() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/unread", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { unread: 0 }))
      .then((data: { unread?: number }) => {
        if (!cancelled) setUnread(data.unread ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return unread;
}
