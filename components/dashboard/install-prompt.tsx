"use client";

import { useEffect, useState } from "react";
import { Download, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // PWA registration is progressive enhancement.
      });
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!online) {
    return (
      <div className="fixed inset-x-4 bottom-20 z-40 rounded-2xl border border-amber-500/30 bg-amber-500/15 px-4 py-3 text-sm text-amber-200 shadow-card lg:left-auto lg:right-6 lg:max-w-sm">
        <span className="flex items-center gap-2"><WifiOff className="h-4 w-4" /> You&apos;re offline. Live bookings need a connection.</span>
      </div>
    );
  }

  if (!installEvent) return null;

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
            setInstallEvent(null);
          }}
        >
          <Download className="h-4 w-4" /> Install
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setInstallEvent(null)}>
          Later
        </Button>
      </div>
    </div>
  );
}
