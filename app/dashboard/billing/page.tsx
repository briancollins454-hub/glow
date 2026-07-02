import { redirect } from "next/navigation";
import { CheckCircle2, CreditCard, Sparkles, Clock } from "lucide-react";
import { getDashboardContext } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isLive, planLabel } from "@/lib/subscriptions";
import { stripeConfigured } from "@/lib/stripe";
import { startCheckoutAction, manageBillingAction } from "./actions";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  const { tech } = c;
  const { status } = await searchParams;
  const live = isLive(tech);
  const configured = stripeConfigured();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-ink-soft">Your Glow subscription. 0% commission - you keep every deposit.</p>
      </div>

      {status === "started" && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Card saved - your trial is being activated. This can take a few seconds.
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
              <Button type="submit" variant="outline"><CreditCard className="h-4 w-4" /> Manage subscription</Button>
            </form>
          ) : (
            <p className="text-sm text-ink-soft">Start your trial below to switch on online bookings and deposits.</p>
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
            Both plans start with <strong>£2 for your first 14 days</strong>, then renew at the plan price. Cancel anytime.
          </p>
        </>
      )}
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
      <form action={startCheckoutAction} className="mt-5">
        <input type="hidden" name="plan" value={plan} />
        <Button type="submit" className="w-full" disabled={!configured}>Start £2 trial</Button>
      </form>
    </div>
  );
}
