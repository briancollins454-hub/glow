"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, MoreVertical, Plus, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ensureInstallCapture,
  getInstallEvent,
  isIosSafari,
  isStandalone,
  promptInstall,
  subscribeInstall,
} from "@/lib/pwa-install";

/**
 * Permanent Settings control: always an Install button first.
 * One click when Chrome/Edge handed us beforeinstallprompt; otherwise the
 * click reveals the short platform steps (iOS has no install API).
 */
export function InstallAppCard() {
  const [ready, setReady] = useState(false);
  const [hasEvent, setHasEvent] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    ensureInstallCapture();
    setInstalled(isStandalone());
    setIos(isIosSafari());
    setHasEvent(!!getInstallEvent());
    setReady(true);
    return subscribeInstall(() => {
      setHasEvent(!!getInstallEvent());
      setInstalled(isStandalone());
    });
  }, []);

  if (!ready) return null;

  if (installed) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">
        <CheckCircle2 className="h-4 w-4 shrink-0" /> You&apos;re using the installed app. Nothing
        else to do.
      </p>
    );
  }

  async function onInstallClick() {
    setBusy(true);
    try {
      const outcome = await promptInstall();
      if (outcome === "unavailable") {
        setShowSteps(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">
        Add Glow to your home screen so the dashboard opens like an app, full screen and one tap
        away.
      </p>
      <Button type="button" disabled={busy} onClick={onInstallClick}>
        <Download className="h-4 w-4" />
        {busy ? "Opening…" : "Install Glow"}
      </Button>

      {showSteps && !hasEvent ? (
        ios ? (
          <ol className="space-y-2 text-sm text-ink-soft">
            <li className="text-ink">Your browser needs one more step:</li>
            <li className="flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-fill-hover text-xs font-semibold text-ink">
                1
              </span>
              <span className="flex flex-wrap items-center gap-1">
                Tap the <Share className="h-4 w-4 text-brand-text" aria-label="Share" /> Share button
                in Safari
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-fill-hover text-xs font-semibold text-ink">
                2
              </span>
              <span className="flex flex-wrap items-center gap-1">
                Choose <span className="font-medium text-ink">Add to Home Screen</span>
                <Plus className="h-4 w-4 text-brand-text" aria-hidden="true" />
              </span>
            </li>
          </ol>
        ) : (
          <ol className="space-y-2 text-sm text-ink-soft">
            <li className="text-ink">Your browser needs one more step:</li>
            <li className="flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-fill-hover text-xs font-semibold text-ink">
                1
              </span>
              <span className="flex flex-wrap items-center gap-1">
                Open the browser menu{" "}
                <MoreVertical className="h-4 w-4 text-brand-text" aria-label="Menu" />
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-fill-hover text-xs font-semibold text-ink">
                2
              </span>
              <span className="flex flex-wrap items-center gap-1">
                Choose <span className="font-medium text-ink">Add to home screen</span> or{" "}
                <span className="font-medium text-ink">Install app</span>
              </span>
            </li>
          </ol>
        )
      ) : null}
    </div>
  );
}
