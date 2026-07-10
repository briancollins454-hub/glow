"use client";

import { useSearchParams } from "next/navigation";
import { CalendarDays, CheckCircle2, Copy, Download, KeyRound, ShieldAlert } from "lucide-react";
import { useDashboardAuth } from "@/hooks/use-dashboard-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  changePasswordAction,
  disconnectGoogleCalendarAction,
  ensureCalendarTokenAction,
  requestAccountClosureAction,
  updateSettingsAction,
} from "../actions";
import { PageBrandingUploads } from "@/components/dashboard/page-branding-uploads";

const PW_ERRORS: Record<string, string> = {
  wrong: "Your current password is incorrect.",
  short: "New password needs to be at least 8 characters.",
  match: "The new passwords don't match.",
  failed: "Something went wrong. Please try again.",
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://glow-uk.com";

const GOOGLE_MSG: Record<string, string> = {
  connected: "Google Calendar connected. New bookings will sync automatically.",
  disconnected: "Google Calendar disconnected.",
  missing: "Google Calendar is not configured yet. Add Google OAuth credentials in the app environment.",
  denied: "Google Calendar connection was cancelled.",
  failed: "Google Calendar connection failed. Please try again.",
};

export default function SettingsPage() {
  const { tech } = useDashboardAuth();
  const searchParams = useSearchParams();
  if (!tech) return null;

  const saved = searchParams.get("saved");
  const pw = searchParams.get("pw");
  const pwerr = searchParams.get("pwerr");
  const calendar = searchParams.get("calendar");
  const closure = searchParams.get("closure");
  const google = searchParams.get("google");
  const photoerr = searchParams.get("photoerr");
  const coverSaved = searchParams.get("cover");
  const profileSaved = searchParams.get("profile");
  const calendarUrl = tech.calendarToken ? `${APP_URL}/api/calendar/${tech.calendarToken}` : "";
  const googleConnected = !!tech.googleRefreshToken && !!tech.googleCalendarId;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-ink-soft">Your branding, public link and protection policy.</p>
      </div>

      {saved && <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Settings saved.</div>}
      {coverSaved === "1" && <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Banner image uploaded.</div>}
      {profileSaved === "1" && <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Profile photo uploaded.</div>}
      {photoerr && <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">Photo upload failed. Use a JPG, PNG or WebP image and try again.</div>}
      {calendar && <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Calendar feed ready.</div>}
      {closure && <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-300"><ShieldAlert className="h-4 w-4" /> Account closure request recorded. Support will follow up before deleting data.</div>}
      {google && <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${google === "connected" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}><CalendarDays className="h-4 w-4" /> {GOOGLE_MSG[google] ?? GOOGLE_MSG.failed}</div>}

      <Card className="border-brand-500/30 bg-brand-500/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-brand-400" /> Google Calendar
          </CardTitle>
          <CardDescription>
            Connect once. Glow will add, update and cancel appointments in Google Calendar automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {googleConnected ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-emerald-300">
                Connected{tech.googleCalendarEmail ? ` to ${tech.googleCalendarEmail}` : ""}.
              </p>
              <form action={disconnectGoogleCalendarAction}>
                <Button type="submit" variant="outline" size="sm">Disconnect</Button>
              </form>
            </div>
          ) : (
            <ButtonLink href="/api/google/calendar/connect" size="lg">
              Connect Google Calendar
            </ButtonLink>
          )}
        </CardContent>
      </Card>

      <form action={updateSettingsAction} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Brand &amp; profile</CardTitle>
            <CardDescription>This is what clients see on your page.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="businessName">Business name</Label><Input id="businessName" name="businessName" defaultValue={tech.businessName} /></div>
            <div><Label htmlFor="name">Your name</Label><Input id="name" name="name" defaultValue={tech.name} /></div>
            <div className="sm:col-span-2">
              <Label htmlFor="handle">Booking link</Label>
              <div className="flex items-center gap-1.5 rounded-xl border border-edge bg-white/[0.04] px-3.5 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/30">
                <span className="text-sm text-ink-faint">glow.app/</span>
                <input id="handle" name="handle" defaultValue={tech.handle} className="w-full bg-transparent py-2.5 text-base outline-none sm:text-sm" />
              </div>
              <p className="mt-1.5 flex items-center gap-1 text-xs text-ink-faint"><Copy className="h-3 w-3" /> Share glow.app/{tech.handle} in your Instagram &amp; TikTok bio.</p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                name="tagline"
                defaultValue={tech.tagline}
                placeholder="Lash & brow specialist in Glasgow"
              />
              <p className="mt-1.5 text-xs text-ink-faint">Short headline on your booking page banner.</p>
            </div>
            <div className="sm:col-span-2"><Label htmlFor="bio">Bio</Label><Textarea id="bio" name="bio" defaultValue={tech.bio} /></div>
            <div><Label htmlFor="location">Location</Label><Input id="location" name="location" defaultValue={tech.location} /></div>
            <div>
              <Label htmlFor="brandColor">Brand colour</Label>
              <div className="flex items-center gap-2">
                <input id="brandColor" name="brandColor" type="color" defaultValue={tech.brandColor} className="h-11 w-16 cursor-pointer rounded-xl border border-edge bg-white/[0.04] p-1" />
                <span className="text-sm text-ink-faint">{tech.brandColor}</span>
              </div>
            </div>
            <div><Label htmlFor="instagram">Instagram handle</Label><Input id="instagram" name="instagram" defaultValue={tech.instagram} placeholder="bellarosebeauty" /></div>
            <div><Label htmlFor="tiktok">TikTok handle</Label><Input id="tiktok" name="tiktok" defaultValue={tech.tiktok} placeholder="bellarosebeauty" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Page photos</CardTitle>
            <CardDescription>
              Banner and profile picture on your public booking page. Each photo uploads straight away when you tap Upload photo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PageBrandingUploads tech={tech} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deposit &amp; no-show protection</CardTitle>
            <CardDescription>Deposits and a clear cancellation window protect your time.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div><Label htmlFor="defaultDepositPct">Deposit you usually take (%)</Label><Input id="defaultDepositPct" name="defaultDepositPct" type="number" min={0} max={100} defaultValue={tech.defaultDepositPct} /></div>
            <div><Label htmlFor="cancellationWindowHours">Notice needed to cancel (hours)</Label><Input id="cancellationWindowHours" name="cancellationWindowHours" type="number" min={0} max={336} defaultValue={tech.cancellationWindowHours} /></div>
            <div><Label htmlFor="noShowFeePct">No-show charge (% of price)</Label><Input id="noShowFeePct" name="noShowFeePct" type="number" min={0} max={100} defaultValue={tech.noShowFeePct} /></div>
            <label className="flex items-start gap-2.5 rounded-xl border border-edge bg-cream px-4 py-3 text-sm sm:col-span-3">
              <input
                type="checkbox"
                name="requiresBookingApproval"
                defaultChecked={tech.requiresBookingApproval}
                className="mt-0.5 h-4 w-4 rounded border-black/20 text-brand-400 focus:ring-brand-300"
              />
              <span>
                <span className="font-medium">Approve bookings before clients pay</span>
                <span className="mt-0.5 block text-xs text-ink-faint">
                  When on, you get an email for each request. Approve first — then the client gets a deposit link.
                  Off by default; your current flow stays the same.
                </span>
              </span>
            </label>
            <p className="text-xs text-ink-faint sm:col-span-3">Cancellations inside {tech.cancellationWindowHours}h forfeit the deposit. No-shows are flagged on the client&apos;s record.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Loyalty reward</CardTitle>
            <CardDescription>
              Thank your regulars automatically: after a number of completed visits, they get a
              discount on every booking. Set visits to 0 to switch it off.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="loyaltyVisitThreshold">After how many visits?</Label>
              <Input id="loyaltyVisitThreshold" name="loyaltyVisitThreshold" type="number" min={0} max={100} defaultValue={tech.loyaltyVisitThreshold} />
            </div>
            <div>
              <Label htmlFor="loyaltyDiscountPct">Discount (%)</Label>
              <Input id="loyaltyDiscountPct" name="loyaltyDiscountPct" type="number" min={0} max={50} defaultValue={tech.loyaltyDiscountPct} />
            </div>
            {tech.loyaltyVisitThreshold > 0 && tech.loyaltyDiscountPct > 0 && (
              <p className="text-xs text-ink-faint sm:col-span-2">
                Currently: clients with {tech.loyaltyVisitThreshold}+ completed visits get {tech.loyaltyDiscountPct}% off automatically.
              </p>
            )}
            <label className="flex items-start gap-2.5 rounded-xl border border-edge bg-cream px-4 py-3 text-sm sm:col-span-2">
              <input
                type="checkbox"
                name="rebookNudgesEnabled"
                defaultChecked={tech.rebookNudgesEnabled}
                className="mt-0.5 h-4 w-4 rounded border-black/20 text-brand-400 focus:ring-brand-300"
              />
              <span>
                <span className="font-medium">Automatic &ldquo;time to rebook&rdquo; emails</span>
                <span className="mt-0.5 block text-xs text-ink-faint">
                  Clients who haven&apos;t visited in 30+ days and have nothing booked get a friendly nudge with your booking link. One per client every two months, max.
                </span>
              </span>
            </label>
          </CardContent>
        </Card>

        <div className="flex justify-end"><Button type="submit">Save settings</Button></div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="h-4 w-4" /> Data export</CardTitle>
          <CardDescription>Full data portability for GDPR/support requests, plus fallback calendar options.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <details className="rounded-xl border border-edge bg-cream p-4">
            <summary className="cursor-pointer font-medium">Fallback: private iCal feed</summary>
            <p className="mt-2 text-sm text-ink-soft">
              Use this only if someone wants Apple/Outlook/iCal instead of direct Google sync.
            </p>
            {calendarUrl ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input readOnly value={calendarUrl} />
                <ButtonLink href={calendarUrl} variant="outline">Open feed</ButtonLink>
              </div>
            ) : (
              <form action={ensureCalendarTokenAction} className="mt-3">
                <Button type="submit" variant="secondary">Create private feed</Button>
              </form>
            )}
            <p className="mt-2 text-xs text-ink-faint">Anyone with this URL can read appointment titles and times. Keep it private.</p>
          </details>

          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/api/account/export" variant="outline">
              <Download className="h-4 w-4" /> Download full account export
            </ButtonLink>
            <ButtonLink href="/api/reports/export" variant="outline">
              <Download className="h-4 w-4" /> Download income CSV
            </ButtonLink>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Change password</CardTitle>
          <CardDescription>Use at least 8 characters. You&apos;ll stay logged in on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          {pw === "1" && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> Password updated.
            </div>
          )}
          {pwerr && (
            <div className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {PW_ERRORS[pwerr] ?? PW_ERRORS.failed}
            </div>
          )}
          <form action={changePasswordAction} className="grid gap-4 sm:grid-cols-3">
            <div><Label htmlFor="current">Current password</Label><Input id="current" name="current" type="password" required /></div>
            <div><Label htmlFor="next">New password</Label><Input id="next" name="next" type="password" required minLength={8} /></div>
            <div><Label htmlFor="confirm">Confirm new password</Label><Input id="confirm" name="confirm" type="password" required minLength={8} /></div>
            <div className="sm:col-span-3"><Button type="submit" variant="secondary">Update password</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-red-400">Close account</CardTitle>
          <CardDescription>
            Records a closure request for support review. Download your full export first if you need a copy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={requestAccountClosureAction} className="space-y-3">
            <div>
              <Label>Reason / anything support should know</Label>
              <Textarea name="reason" placeholder="Optional" />
            </div>
            <Button type="submit" variant="danger">
              <ShieldAlert className="h-4 w-4" /> Request account closure
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
