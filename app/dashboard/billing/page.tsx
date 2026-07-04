import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { CheckCircle2, CreditCard, Sparkles, Clock, Gift } from "lucide-react";
import { getDashboardContext } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { isLive, planLabel } from "@/lib/subscriptions";
import { stripeConfigured } from "@/lib/stripe";
import { startCheckoutAction, manageBillingAction } from "./actions";

const APP_HOST = (process.env.NEXT_PUBLIC_APP_URL ?? "https://glow-uk.com").replace(/^https?:\/\//, "");

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  const { sb, tech } = c;
  const { status } = await searchParams;
  const live = isLive(tech);
  const configured = stripeConfigured();
  const isTester = (await cookies()).get("glow_offer")?.value === "tester";

  // RLS hides other techs' rows, so count referrals with the service client.
  const { supabaseService, serviceConfigured } = await import("@/lib/supabase/service");
  let referredCount = 0;
  if (serviceConfigured()) {
    const { count } = await supabaseService()
      .from("techs")
      .select("id", { count: "exact", head: true })
      .eq("referredBy", tech.handle);
    referredCount = count ?? 0;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">My plan</h1>
        <p className="text-sm text-ink-soft">Your Glow membership. 0% commission - you keep every penny your clients pay you.</p>
      </div>

      {status === "started" && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Card saved - your subscription is being activated. This can take a few seconds.
        </div>
      )}
      {isTester && !live && (
        <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm text-brand-300">
          <strong>Tester offer active:</strong> your first month is £1 (monthly plan). Thanks for helping test Glow!
        </div>
      )}
      {status === "cancelled" && (
        <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-300">Checkout cancelled - no charge was made.</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current plan {live ? <Badge tone="green">Active</Badge> : <Badge tone="amber">Not live</Badge>}
          </CardTitle>
          <CardDescription>{planLabel(tech)}</CardDescription>
        </CardHeader>
        <CardContent>
          {tech.subscriptionStatus === "comped" ? (
            <p className="text-sm text-ink-soft">This account has complimentary access.</p>
          ) : live ? (
            <form action={manageBillingAction}>
              <p className="mb-3 text-sm text-ink-soft">Update your card, view invoices, or cancel anytime.</p>
              <Button type="submit" variant="outline"><CreditCard className="h-4 w-4" /> Manage my plan</Button>
            </form>
          ) : (
            <p className="text-sm text-ink-soft">Subscribe below to switch on online bookings and deposits.</p>
          )}
        </CardContent>
      </Card>

      {!live && (
        <>
          {!configured && (
            <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              Payments aren&apos;t configured on this environment yet.
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <PlanCard
              title="Monthly"
              price="£19"
              cadence="/month"
              plan="monthly"
              configured={configured}
              highlight
              note={isTester ? "First month £1" : "50% off first month"}
            />
            <PlanCard
              title="Annual"
              price="£180"
              cadence="/year"
              plan="annual"
              configured={configured}
              note="Save ~2 months"
            />
          </div>
          <p className="text-center text-xs text-ink-faint">
            {isTester
              ? "Tester offer: first month £1, then £19/mo. Cancel anytime."
              : "50% off your first month on the monthly plan, then £19/mo. Cancel anytime."}
          </p>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Gift className="h-4 w-4" /> Refer a tech, get a free month</CardTitle>
          <CardDescription>
            Share your link. When a tech you refer becomes a paying member, we credit a free month to your bill.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-xl border border-edge bg-white/[0.04] px-3 py-2 text-sm">
              {APP_HOST}/signup?ref={tech.handle}
            </code>
            <Badge tone="brand">{referredCount} signed up via your link</Badge>
          </div>
          <p className="text-xs text-ink-faint">
            Credits are applied to your next invoice. Referrals are tracked automatically when someone signs up through your link.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function PlanCard({ title, price, cadence, plan, configured, highlight, note }: { title: string; price: string; cadence: string; plan: "monthly" | "annual"; configured: boolean; highlight?: boolean; note?: string; }) {
  return (
    <div className={`card p-6 ${highlight ? "ring-2 ring-brand-300" : ""}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        {note && <Badge tone="brand">{note}</Badge>}
      </div>
      <p className="mt-2"><span className="text-3xl font-semibold">{price}</span><span className="text-ink-faint">{cadence}</span></p>
      <ul className="mt-4 space-y-2 text-sm text-ink-soft">
        <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-500" /> Branded booking page</li>
        <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand-500" /> Deposits &amp; no-show protection</li>
        <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-brand-500" /> Reminders &amp; infill rules</li>
      </ul>
      <form action={startCheckoutAction} className="mt-5 space-y-3">
        <input type="hidden" name="plan" value={plan} />
        <div>
          <Label>Promo code (optional)</Label>
          <Input name="promo" placeholder="Have a code?" />
        </div>
        <Button type="submit" className="w-full" disabled={!configured}>Subscribe</Button>
      </form>
    </div>
  );
}
