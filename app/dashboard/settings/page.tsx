import { CheckCircle2, Copy, KeyRound } from "lucide-react";
import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { updateSettingsAction, changePasswordAction } from "../actions";

const PW_ERRORS: Record<string, string> = {
  wrong: "Your current password is incorrect.",
  short: "New password needs to be at least 8 characters.",
  match: "The new passwords don't match.",
  failed: "Something went wrong. Please try again.",
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; pw?: string; pwerr?: string }> }) {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  const { tech } = c;
  const { saved, pw, pwerr } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-ink-soft">Your branding, public link and protection policy.</p>
      </div>

      {saved && <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Settings saved.</div>}

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
            <CardTitle>Deposit &amp; no-show protection</CardTitle>
            <CardDescription>Deposits and a clear cancellation window protect your time.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div><Label htmlFor="defaultDepositPct">Deposit you usually take (%)</Label><Input id="defaultDepositPct" name="defaultDepositPct" type="number" min={0} max={100} defaultValue={tech.defaultDepositPct} /></div>
            <div><Label htmlFor="cancellationWindowHours">Notice needed to cancel (hours)</Label><Input id="cancellationWindowHours" name="cancellationWindowHours" type="number" min={0} max={336} defaultValue={tech.cancellationWindowHours} /></div>
            <div><Label htmlFor="noShowFeePct">No-show charge (% of price)</Label><Input id="noShowFeePct" name="noShowFeePct" type="number" min={0} max={100} defaultValue={tech.noShowFeePct} /></div>
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
          </CardContent>
        </Card>

        <div className="flex justify-end"><Button type="submit">Save settings</Button></div>
      </form>

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
    </div>
  );
}
