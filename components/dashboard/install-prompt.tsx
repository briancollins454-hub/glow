"use client";

import { useEffect, useState } from "react";
import { Download, WifiOff, Share, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

// Snooze a dismissed prompt so we don't nag on every dashboard load.
const DISMISS_KEY = "glow_install_dismissed_at";
const DISMISS_DAYS = 14;

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Private mode / storage disabled — dismissal just won't persist.
  }
}

/** Already running as an installed PWA (Android/desktop display-mode, or iOS standalone). */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const displayStandalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const iosStandalone =
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return displayStandalone || iosStandalone;
}

/**
 * iOS Safari never fires `beforeinstallprompt`, so there's no automatic install
 * button — the user must use Share → Add to Home Screen. Detect that case so we
 * can show manual instructions. iPadOS 13+ reports as "MacIntel" with touch, so
 * we check maxTouchPoints too. Chrome/Firefox on iOS (CriOS/FxiOS) are excluded
 * because the Add to Home Screen steps differ from Safari's.
 */
function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iDevice =
    /iphone|ipod|ipad/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!iDevice) return false;
  if (/crios|fxios|edgios/i.test(ua)) return false;
  return true;
}

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [online, setOnline] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // PWA registration is progressive enhancement.
      });
    }

    // Only offer an install path when we're not already installed and haven't
    // been snoozed. Android/desktop Chrome/Edge fire beforeinstallprompt below;
    // iOS Safari needs the manual card.
    if (!isStandalone() && !recentlyDismissed() && isIosSafari()) {
      setShowIos(true);
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      if (isStandalone() || recentlyDismissed()) return;
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setShowIos(false);
    };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const dismiss = () => {
    markDismissed();
    setInstallEvent(null);
    setShowIos(false);
    setDismissed(true);
  };

  if (!online) {
    return (
      <div className="fixed inset-x-4 bottom-20 z-40 rounded-2xl border border-amber-500/30 bg-amber-500/15 px-4 py-3 text-sm text-amber-200 shadow-card lg:left-auto lg:right-6 lg:max-w-sm">
        <span className="flex items-center gap-2"><WifiOff className="h-4 w-4" /> You&apos;re offline. Live bookings need a connection.</span>
      </div>
    );
  }

  if (dismissed) return null;

  // Android / Windows / desktop (Chrome, Edge): native install prompt available.
  if (installEvent) {
    return (
      <div className="fixed inset-x-4 bottom-20 z-40 rounded-2xl border border-edge bg-surface/95 p-4 shadow-card backdrop-blur lg:left-auto lg:right-6 lg:max-w-sm">
        <p className="font-medium">Install Glow</p>
        <p className="mt-1 text-sm text-ink-soft">Open your dashboard from your home screen like an app.</p>
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={async () => {
              await installEvent.prompt();
              await installEvent.userChoice;
              dismiss();
            }}
          >
            <Download className="h-4 w-4" /> Install
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
            Later
          </Button>
        </div>
      </div>
    );
  }

  // iPhone / iPad Safari: no native prompt — show the Add to Home Screen steps.
  if (showIos) {
    return (
      <div className="fixed inset-x-4 bottom-20 z-40 rounded-2xl border border-edge bg-surface/95 p-4 shadow-card backdrop-blur lg:left-auto lg:right-6 lg:max-w-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">Install Glow on your iPhone</p>
            <p className="mt-1 text-sm text-ink-soft">Add it to your home screen to open your dashboard like an app.</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="-mr-1 -mt-1 rounded-lg p-1 text-ink-faint transition hover:bg-white/[0.06] hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ol className="mt-3 space-y-2 text-sm text-ink-soft">
          <li className="flex items-center gap-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold text-ink">1</span>
            <span className="flex flex-wrap items-center gap-1">
              Tap the <Share className="h-4 w-4 text-brand-300" aria-label="Share" /> Share button in Safari
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold text-ink">2</span>
            <span className="flex flex-wrap items-center gap-1">
              Choose <span className="font-medium text-ink">Add to Home Screen</span>
              <Plus className="h-4 w-4 text-brand-300" aria-hidden="true" />
            </span>
          </li>
        </ol>
      </div>
    );
  }

  return null;
}
