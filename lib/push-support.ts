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

/** VAPID public key (base64url) → Uint8Array for pushManager.subscribe. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}
