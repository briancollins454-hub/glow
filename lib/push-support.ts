/**
 * Pure device-support classification for push notifications (testable without
 * a browser). iOS only supports web push from a Home Screen install on
 * iOS 16.4+; Safari tab push does not exist, so we show install guidance
 * instead of a dead enable button.
 */

export type PushSupport =
  | { state: "supported" }
  | { state: "ios_install_required" }
  | { state: "ios_version_too_old"; version: string }
  | { state: "unsupported" };

/** Client/server failure codes for the enable + save flow. */
export type PushEnableFailureCode =
  | "vapid_missing"
  | "vapid_malformed"
  | "permission_denied"
  | "permission_dismissed"
  | "sw_unavailable"
  | "subscribe_rejected"
  | "invalid_payload"
  | "unauthorized"
  | "save_failed";

export const PUSH_ENABLE_MESSAGES: Record<PushEnableFailureCode, string> = {
  vapid_missing:
    "Push isn't configured on this environment yet (missing public key). Ask support to check VAPID settings.",
  vapid_malformed:
    "Push isn't configured correctly on this environment (invalid public key). Ask support to check VAPID settings.",
  permission_denied:
    "Notifications are blocked for this site. Allow them in your browser settings (padlock → Notifications → Allow), then reload and try again.",
  permission_dismissed: "Notification permission wasn't granted. Tap the button again and choose Allow.",
  sw_unavailable:
    "This browser couldn't start the notification service. Close other Glow tabs, reload this page, and try again.",
  subscribe_rejected:
    "This browser rejected the push subscription. Check that notifications are allowed, then try again.",
  invalid_payload: "This device sent an incomplete push subscription. Please try again.",
  unauthorized: "Please sign in again, then turn on notifications.",
  save_failed: "Couldn't save this device on the server. Please try again.",
};

export function pushEnableMessage(code: PushEnableFailureCode, detail?: string): string {
  const base = PUSH_ENABLE_MESSAGES[code];
  if (detail && code === "save_failed") return `${base} (${detail})`;
  return base;
}

export function isIosUserAgent(ua: string): boolean {
  if (/iphone|ipod|ipad/i.test(ua)) return true;
  // iPadOS 13+ masquerades as macOS but is still touch-first Safari.
  return /macintosh/i.test(ua) && /mobile/i.test(ua);
}

/** Major.minor iOS version from the UA, or null when it can't be read. */
export function iosVersion(ua: string): { major: number; minor: number } | null {
  const m = ua.match(/OS (\d+)[._](\d+)/i) ?? ua.match(/Version\/(\d+)\.(\d+)/i);
  if (!m) return null;
  return { major: parseInt(m[1]!, 10), minor: parseInt(m[2]!, 10) };
}

export function classifyPushSupport(opts: {
  userAgent: string;
  standalone: boolean;
  hasPushApi: boolean;
}): PushSupport {
  const ios = isIosUserAgent(opts.userAgent);
  if (ios) {
    if (!opts.standalone) return { state: "ios_install_required" };
    const v = iosVersion(opts.userAgent);
    if (v && (v.major < 16 || (v.major === 16 && v.minor < 4))) {
      return { state: "ios_version_too_old", version: `${v.major}.${v.minor}` };
    }
    // Installed and new enough — trust the API check from here.
    return opts.hasPushApi ? { state: "supported" } : { state: "ios_version_too_old", version: "unknown" };
  }
  return opts.hasPushApi ? { state: "supported" } : { state: "unsupported" };
}

function decodeBase64Url(base64String: string): Uint8Array {
  const trimmed = base64String.trim();
  if (!trimmed) throw new Error("empty");
  const padding = "=".repeat((4 - (trimmed.length % 4)) % 4);
  const base64 = (trimmed + padding).replace(/-/g, "+").replace(/_/g, "/");
  // atob is available in browsers and modern Node (vitest).
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * VAPID public key (base64url) → Uint8Array for pushManager.subscribe.
 * Uncompressed P-256 public keys are 65 bytes and start with 0x04.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  return decodeBase64Url(base64String);
}

/** True when the key decodes to a plausible uncompressed P-256 public key. */
export function isValidVapidPublicKey(base64String: string): boolean {
  try {
    const bytes = decodeBase64Url(base64String);
    return bytes.length === 65 && bytes[0] === 0x04;
  } catch {
    return false;
  }
}

/** Hostname from a push endpoint URL (for diagnostics; never show the full URL). */
export function pushEndpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Normalise a browser PushSubscriptionJSON (or our flat action payload) into
 * endpoint + p256dh + auth. Rejects incomplete shapes.
 */
export function normalizePushSubscriptionPayload(input: {
  endpoint?: unknown;
  p256dh?: unknown;
  auth?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown } | null;
}): { ok: true; endpoint: string; p256dh: string; auth: string } | { ok: false } {
  const endpoint = String(input.endpoint ?? "").trim();
  const p256dh = String(input.p256dh ?? input.keys?.p256dh ?? "").trim();
  const auth = String(input.auth ?? input.keys?.auth ?? "").trim();
  if (!endpoint.startsWith("https://") || !p256dh || !auth) return { ok: false };
  return { ok: true, endpoint, p256dh, auth };
}
