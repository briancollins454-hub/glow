"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Bell, BellOff, CheckCircle2, Laptop, Share, Smartphone, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  listPushDevicesAction,
  subscribePushAction,
  unsubscribePushAction,
  updatePushPrefsAction,
  type PushDevice,
} from "@/app/dashboard/push-actions";
import { classifyPushSupport, urlBase64ToUint8Array, type PushSupport } from "@/lib/push-support";
import { fmtDate } from "@/lib/format";
import { useSalonTz } from "@/components/locale/locale-provider";
import type { PushKind, PushPrefs } from "@/lib/db/types";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

const KIND_ROWS: { kind: PushKind; label: string; hint?: string }[] = [
  { kind: "new_booking", label: "New booking" },
  { kind: "booking_cancelled", label: "Booking cancelled by client" },
  { kind: "booking_rescheduled", label: "Booking rescheduled by client" },
  { kind: "payment_received", label: "Client paid a deposit or balance" },
  { kind: "form_completed", label: "Consultation form or signed consent completed" },
  { kind: "waitlist_claimed", label: "Waitlist client claimed a freed slot" },
  {
    kind: "daily_summary",
    label: "Daily summary",
    hint: "Today's appointment count and first appointment time.",
  },
];

function deviceLabel(userAgent: string): { icon: "phone" | "desktop"; name: string } {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipod/.test(ua)) return { icon: "phone", name: "iPhone" };
  if (/ipad/.test(ua)) return { icon: "phone", name: "iPad" };
  if (/android/.test(ua) && /mobile/.test(ua)) return { icon: "phone", name: "Android phone" };
  if (/android/.test(ua)) return { icon: "phone", name: "Android tablet" };
  if (/macintosh/.test(ua)) return { icon: "desktop", name: "Mac" };
  if (/windows/.test(ua)) return { icon: "desktop", name: "Windows PC" };
  if (/linux/.test(ua)) return { icon: "desktop", name: "Linux" };
  return { icon: "desktop", name: "Device" };
}

export function PushNotificationsCard({ prefs }: { prefs: PushPrefs | null | undefined }) {
  const tz = useSalonTz();
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [devices, setDevices] = useState<PushDevice[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  // Draft prefs (saved via the Save button below).
  const [kinds, setKinds] = useState<Partial<Record<PushKind, boolean>>>(() => prefs?.kinds ?? {});
  const [emailAlso, setEmailAlso] = useState(prefs?.emailAlso !== false);
  const [quietOn, setQuietOn] = useState(prefs?.quietHoursEnabled === true);
  const [quietStart, setQuietStart] = useState(prefs?.quietStart ?? "21:00");
  const [quietEnd, setQuietEnd] = useState(prefs?.quietEnd ?? "08:00");
  const [summaryTime, setSummaryTime] = useState(prefs?.dailySummaryTime ?? "08:00");

  const refreshDevices = useCallback(async (endpoint: string | null) => {
    const list = await listPushDevicesAction({ currentEndpoint: endpoint ?? undefined });
    setDevices(list);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const standalone =
        window.matchMedia?.("(display-mode: standalone)").matches ||
        // iOS Safari's non-standard flag.
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      const hasPushApi =
        "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      const info = classifyPushSupport({
        userAgent: navigator.userAgent,
        standalone,
        hasPushApi,
      });
      if (cancelled) return;
      setSupport(info);
      if (info.state !== "supported") {
        setDevices([]);
        return;
      }
      setPermission(Notification.permission);
      let endpoint: string | null = null;
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        endpoint = sub?.endpoint ?? null;
      } catch {
        // No registration yet — fine.
      }
      if (cancelled) return;
      setCurrentEndpoint(endpoint);
      await refreshDevices(endpoint);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshDevices]);

  const enable = async () => {
    setError(null);
    setBusy(true);
    try {
      if (!VAPID_PUBLIC_KEY) {
        setError("Push isn't configured on this environment yet.");
        return;
      }
      // Only ever called from this tap — never on page load.
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        }));
      const json = sub.toJSON();
      const result = await subscribePushAction({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });
      if (!result.ok) {
        setError("Couldn't save this device. Please try again.");
        return;
      }
      setCurrentEndpoint(sub.endpoint);
      await refreshDevices(sub.endpoint);
    } catch (err) {
      console.error("[push] enable failed", err);
      setError("Couldn't turn on notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const removeDevice = async (device: PushDevice) => {
    setBusy(true);
    try {
      if (device.mine) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          await sub?.unsubscribe();
        } catch {
          // Server-side removal still proceeds.
        }
        setCurrentEndpoint(null);
      }
      await unsubscribePushAction({ id: device.id });
      await refreshDevices(device.mine ? null : currentEndpoint);
    } finally {
      setBusy(false);
    }
  };

  const savePrefs = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updatePushPrefsAction({
        kinds,
        emailAlso,
        quietHoursEnabled: quietOn,
        quietStart,
        quietEnd,
        dailySummaryTime: summaryTime,
      });
      if (!result.ok) {
        setError(result.error ?? "Couldn't save. Please try again.");
        if (result.error) setEmailAlso(true);
        return;
      }
      setSaved(true);
    });
  };

  const enabledHere = !!currentEndpoint && (devices ?? []).some((d) => d.mine);
  const hasAnyDevice = (devices ?? []).length > 0;

  const statusLine = useMemo(() => {
    if (!support || support.state !== "supported") return null;
    if (permission === "denied") return null;
    if (enabledHere) return "Notifications are on for this device.";
    if (hasAnyDevice) return "Enabled on other devices — turn on here too if you want them on this one.";
    return "Not enabled yet.";
  }, [support, permission, enabledHere, hasAnyDevice]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-brand-400" /> Notifications
        </CardTitle>
        <CardDescription>
          Get booking alerts straight to this device. Push adds to your emails — it doesn&apos;t
          replace them unless you choose that below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Enable / state */}
        {support === null ? (
          <p className="text-sm text-ink-faint">Checking this device…</p>
        ) : support.state === "ios_install_required" ? (
          <div className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-text">
            <p className="flex items-center gap-2 font-medium">
              <Share className="h-4 w-4" /> Install Glow first to get notifications on iPhone or iPad
            </p>
            <p className="mt-1">
              Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>, then open Glow
              from your home screen to turn on notifications.
            </p>
          </div>
        ) : support.state === "ios_version_too_old" ? (
          <div className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-text">
            Notifications need iOS 16.4 or later
            {support.version !== "unknown" ? ` (this device reports iOS ${support.version})` : ""}.
            Update in Settings → General → Software Update, then come back here.
          </div>
        ) : support.state === "unsupported" ? (
          <div className="rounded-xl bg-fill px-4 py-3 text-sm text-ink-soft">
            This browser doesn&apos;t support push notifications. Try Chrome, Edge or Firefox — or
            install Glow on your phone.
          </div>
        ) : permission === "denied" ? (
          <div className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-text">
            <p className="flex items-center gap-2 font-medium">
              <BellOff className="h-4 w-4" /> Notifications are blocked in your browser settings
            </p>
            <p className="mt-1">
              Re-enable them for this site (usually the padlock icon next to the address bar →
              Notifications → Allow), then reload this page.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {statusLine && (
              <p className="flex items-center gap-2 text-sm text-ink-soft">
                {enabledHere && <CheckCircle2 className="h-4 w-4 text-success-text" />}
                {statusLine}
              </p>
            )}
            {!enabledHere && (
              <Button type="button" onClick={enable} disabled={busy}>
                <Bell className="h-4 w-4" /> Turn on notifications on this device
              </Button>
            )}
          </div>
        )}

        {/* Device list */}
        {devices !== null && devices.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Devices with notifications on</p>
            {devices.map((d) => {
              const info = deviceLabel(d.userAgent);
              return (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-edge bg-cream px-4 py-2.5 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {info.icon === "phone" ? (
                      <Smartphone className="h-4 w-4 shrink-0 text-ink-faint" />
                    ) : (
                      <Laptop className="h-4 w-4 shrink-0 text-ink-faint" />
                    )}
                    <span className="truncate">
                      {info.name}
                      {d.mine ? " (this device)" : ""}
                      <span className="text-xs text-ink-faint"> · last used {fmtDate(d.lastSeenAt, tz)}</span>
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeDevice(d)}
                    disabled={busy}
                    aria-label={`Remove ${info.name}`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-faint hover:bg-danger-soft hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Per-type toggles */}
        <div className="space-y-2">
          <p className="text-sm font-medium">What to send</p>
          {KIND_ROWS.map((row) => (
            <label
              key={row.kind}
              className="flex items-start gap-2.5 rounded-xl border border-edge bg-cream px-4 py-2.5 text-sm"
            >
              <input
                type="checkbox"
                checked={kinds[row.kind] !== false}
                onChange={(e) => setKinds((k) => ({ ...k, [row.kind]: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-edge text-brand-400 focus:ring-brand-300"
              />
              <span>
                <span className="font-medium">{row.label}</span>
                {row.hint && <span className="mt-0.5 block text-xs text-ink-faint">{row.hint}</span>}
                {row.kind === "daily_summary" && (
                  <span className="mt-1.5 flex items-center gap-2 text-xs text-ink-faint">
                    Send at{" "}
                    <input
                      type="time"
                      value={summaryTime}
                      onChange={(e) => setSummaryTime(e.target.value)}
                      className="rounded-lg border border-edge bg-fill px-2 py-1 text-xs text-ink"
                    />
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>

        {/* Quiet hours */}
        <label className="flex items-start gap-2.5 rounded-xl border border-edge bg-cream px-4 py-2.5 text-sm">
          <input
            type="checkbox"
            checked={quietOn}
            onChange={(e) => setQuietOn(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-edge text-brand-400 focus:ring-brand-300"
          />
          <span className="min-w-0 flex-1">
            <span className="font-medium">Quiet hours</span>
            <span className="mt-0.5 block text-xs text-ink-faint">
              Hold non-urgent notifications overnight and send them when quiet hours end.
              Cancellations always come through immediately.
            </span>
            {quietOn && (
              <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                From{" "}
                <input
                  type="time"
                  value={quietStart}
                  onChange={(e) => setQuietStart(e.target.value)}
                  className="rounded-lg border border-edge bg-fill px-2 py-1 text-xs text-ink"
                />{" "}
                to{" "}
                <input
                  type="time"
                  value={quietEnd}
                  onChange={(e) => setQuietEnd(e.target.value)}
                  className="rounded-lg border border-edge bg-fill px-2 py-1 text-xs text-ink"
                />
              </span>
            )}
          </span>
        </label>

        {/* Email supplement */}
        <label className="flex items-start gap-2.5 rounded-xl border border-edge bg-cream px-4 py-2.5 text-sm">
          <input
            type="checkbox"
            checked={emailAlso}
            onChange={(e) => setEmailAlso(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-edge text-brand-400 focus:ring-brand-300"
          />
          <span>
            <span className="font-medium">Also send these by email</span>
            <span className="mt-0.5 block text-xs text-ink-faint">
              Turn off to rely on push alone. Needs push enabled on at least one device — and if
              your last device stops working, email switches itself back on so you never miss a
              booking. Emails to your clients are never affected.
            </span>
          </span>
        </label>

        {error && (
          <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-text">{error}</div>
        )}
        {saved && (
          <div className="flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">
            <CheckCircle2 className="h-4 w-4" /> Notification settings saved.
          </div>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={savePrefs} disabled={pending}>
            Save notification settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
