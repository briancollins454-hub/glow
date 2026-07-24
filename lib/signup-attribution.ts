/** Client-side signup attribution (UTM + partner) captured on first visit. */

export const ATTRIBUTION_STORAGE_KEY = "glow_signup_attribution";

export const HEAR_ABOUT_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook_group", label: "Facebook group" },
  { value: "google", label: "Google search" },
  { value: "referred_by_tech", label: "Referred by another tech" },
  { value: "training_academy", label: "My training academy" },
  { value: "other", label: "Other" },
] as const;

export type HearAboutValue = (typeof HEAR_ABOUT_OPTIONS)[number]["value"];

export type SignupAttribution = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  partnerSlug?: string | null;
  capturedAt?: string;
};

function clean(value: string | null | undefined): string | null {
  const v = (value ?? "").trim().slice(0, 120);
  return v || null;
}

export function parseAttributionFromSearchParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): SignupAttribution {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) return clean(params.get(key));
    const raw = params[key];
    if (Array.isArray(raw)) return clean(raw[0]);
    return clean(raw);
  };

  // Partner code may arrive as ?partner= or historically as ?ref= when it is
  // not a tech handle — callers decide which field to persist as partnerSlug.
  return {
    utmSource: get("utm_source"),
    utmMedium: get("utm_medium"),
    utmCampaign: get("utm_campaign"),
    partnerSlug: get("partner"),
  };
}

export function mergeAttribution(
  existing: SignupAttribution | null | undefined,
  next: SignupAttribution,
): SignupAttribution {
  const base = existing ?? {};
  return {
    utmSource: base.utmSource || next.utmSource || null,
    utmMedium: base.utmMedium || next.utmMedium || null,
    utmCampaign: base.utmCampaign || next.utmCampaign || null,
    partnerSlug: next.partnerSlug || base.partnerSlug || null,
    capturedAt: base.capturedAt ?? new Date().toISOString(),
  };
}

export function readStoredAttribution(): SignupAttribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SignupAttribution;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStoredAttribution(attr: SignupAttribution): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attr));
  } catch {
    // Ignore quota / private mode failures.
  }
}

/** Capture UTMs / partner from the current URL into localStorage (first-touch). */
export function captureAttributionFromUrl(partnerSlug?: string | null): SignupAttribution {
  if (typeof window === "undefined") return {};
  const fromUrl = parseAttributionFromSearchParams(new URLSearchParams(window.location.search));
  if (partnerSlug) fromUrl.partnerSlug = clean(partnerSlug);
  const merged = mergeAttribution(readStoredAttribution(), fromUrl);
  if (merged.utmSource || merged.utmMedium || merged.utmCampaign || merged.partnerSlug) {
    writeStoredAttribution(merged);
  }
  return merged;
}
