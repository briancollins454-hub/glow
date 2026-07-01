import { CheckCircle2, Copy } from "lucide-react";
import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { updateSettingsAction } from "../actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  const { tech } = c;
  const { saved } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-ink-soft">Your branding, public link and protection policy.</p>
      </div>

      {saved && <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Settings saved.</div>}

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
              <div className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3.5 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-200">
                <span className="text-sm text-ink-faint">glow.app/</span>
                <input id="handle" name="handle" defaultValue={tech.handle} className="w-full bg-transparent py-2.5 text-sm outline-none" />
              </div>
              <p className="mt-1.5 flex items-center gap-1 text-xs text-ink-faint"><Copy className="h-3 w-3" /> Share glow.app/{tech.handle} in your Instagram &amp; TikTok bio.</p>
            </div>
            <div className="sm:col-span-2"><Label htmlFor="bio">Bio</Label><Textarea id="bio" name="bio" defaultValue={tech.bio} /></div>
            <div><Label htmlFor="location">Location</Label><Input id="location" name="location" defaultValue={tech.location} /></div>
            <div>
              <Label htmlFor="brandColor">Brand colour</Label>
              <div className="flex items-center gap-2">
                <input id="brandColor" name="brandColor" type="color" defaultValue={tech.brandColor} className="h-11 w-16 cursor-pointer rounded-xl border border-black/10 bg-white p-1" />
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
            <div><Label htmlFor="defaultDepositPct">Default deposit (%)</Label><Input id="defaultDepositPct" name="defaultDepositPct" type="number" min={0} max={100} defaultValue={tech.defaultDepositPct} /></div>
            <div><Label htmlFor="cancellationWindowHours">Cancellation window (hours)</Label><Input id="cancellationWindowHours" name="cancellationWindowHours" type="number" min={0} max={336} defaultValue={tech.cancellationWindowHours} /></div>
            <div><Label htmlFor="noShowFeePct">No-show fee (% of price)</Label><Input id="noShowFeePct" name="noShowFeePct" type="number" min={0} max={100} defaultValue={tech.noShowFeePct} /></div>
            <p className="text-xs text-ink-faint sm:col-span-3">Cancellations inside {tech.cancellationWindowHours}h forfeit the deposit. No-shows are flagged on the client&apos;s record.</p>
          </CardContent>
        </Card>

        <div className="flex justify-end"><Button type="submit">Save settings</Button></div>
      </form>
    </div>
  );
}
