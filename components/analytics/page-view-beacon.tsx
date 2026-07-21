"use client";

/**
 * Fires once per real browser visit. Public marketing and booking pages are
 * ISR-cached, so server-side trackPageView only ran on cache regeneration
 * (often showing 0 traffic). This beacon hits /api/t on every actual load.
 */
import { useEffect, useRef } from "react";

export function PageViewBeacon({
  path,
  techId,
}: {
  path: string;
  techId?: string | null;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    const params = new URLSearchParams(window.location.search);
    const body = {
      path,
      techId: techId ?? null,
      referrer: document.referrer ? document.referrer.slice(0, 500) : null,
      utmSource: params.get("utm_source")?.slice(0, 100) ?? null,
      utmMedium: params.get("utm_medium")?.slice(0, 100) ?? null,
      utmCampaign: params.get("utm_campaign")?.slice(0, 100) ?? null,
    };

    const payload = JSON.stringify(body);
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        if (navigator.sendBeacon("/api/t", blob)) return;
      }
    } catch {
      // Fall through to fetch.
    }

    void fetch("/api/t", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Analytics must never break the page.
    });
  }, [path, techId]);

  return null;
}
