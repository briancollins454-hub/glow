"use client";

/**
 * Shared PWA install state. Chrome fires `beforeinstallprompt` once per page
 * load; whoever captures it must keep it for any UI that offers Install later
 * (bottom prompt AND the permanent Settings card).
 */

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
let listening = false;
const subscribers = new Set<() => void>();

function notify() {
  for (const fn of subscribers) fn();
}

/** Idempotent: start capturing the install prompt (call from any client mount). */
export function ensureInstallCapture(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export function getInstallEvent(): BeforeInstallPromptEvent | null {
  return deferred;
}

export function clearInstallEvent(): void {
  deferred = null;
  notify();
}

export function subscribeInstall(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/**
 * Trigger the browser install UI from a user gesture.
 * Returns "unavailable" when the browser never gave us beforeinstallprompt
 * (iOS Safari, Firefox, or Chrome criteria not met yet).
 */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferred;
  if (!event) return "unavailable";
  await event.prompt();
  const { outcome } = await event.userChoice;
  clearInstallEvent();
  return outcome;
}

/** Already running as an installed PWA (Android/desktop display-mode, or iOS standalone). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const displayStandalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return displayStandalone || iosStandalone;
}

/**
 * iOS Safari never fires `beforeinstallprompt`; users install via
 * Share > Add to Home Screen. iPadOS 13+ reports as MacIntel with touch.
 * Chrome/Firefox/Edge on iOS are excluded because their steps differ.
 */
export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iDevice =
    /iphone|ipod|ipad/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!iDevice) return false;
  if (/crios|fxios|edgios/i.test(ua)) return false;
  return true;
}
