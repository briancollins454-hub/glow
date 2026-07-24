"use client";

import { useEffect } from "react";
import { captureAttributionFromUrl } from "@/lib/signup-attribution";

/** Drop on marketing pages so first-touch UTMs survive until signup. */
export function AttributionCapture({ partnerSlug }: { partnerSlug?: string | null } = {}) {
  useEffect(() => {
    captureAttributionFromUrl(partnerSlug ?? null);
  }, [partnerSlug]);
  return null;
}
