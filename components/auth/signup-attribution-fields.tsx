"use client";

import { useEffect, useState } from "react";
import {
  captureAttributionFromUrl,
  readStoredAttribution,
  type SignupAttribution,
} from "@/lib/signup-attribution";

/**
 * Persists first-touch UTM / partner params, then renders hidden signup fields.
 * Optional partnerSlug overrides (used on /partner/[slug] co-branded signup).
 */
export function SignupAttributionFields({
  partnerSlug,
}: {
  partnerSlug?: string | null;
}) {
  const [attr, setAttr] = useState<SignupAttribution | null>(null);

  useEffect(() => {
    const captured = captureAttributionFromUrl(partnerSlug ?? null);
    setAttr(captured.utmSource || captured.utmMedium || captured.utmCampaign || captured.partnerSlug
      ? captured
      : readStoredAttribution());
  }, [partnerSlug]);

  if (!attr) return null;

  return (
    <>
      {attr.utmSource ? <input type="hidden" name="utmSource" value={attr.utmSource} /> : null}
      {attr.utmMedium ? <input type="hidden" name="utmMedium" value={attr.utmMedium} /> : null}
      {attr.utmCampaign ? <input type="hidden" name="utmCampaign" value={attr.utmCampaign} /> : null}
      {(partnerSlug || attr.partnerSlug) ? (
        <input type="hidden" name="partnerSlug" value={partnerSlug || attr.partnerSlug || ""} />
      ) : null}
    </>
  );
}
