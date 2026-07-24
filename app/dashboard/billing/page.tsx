"use client";

import { useSearchParams } from "next/navigation";
import { CheckCircle2, CreditCard, Sparkles, Clock, Gift } from "lucide-react";
import { AsyncDashboardPage } from "@/components/dashboard/async-dashboard-page";
import { useDashboardAuth } from "@/hooks/use-dashboard-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { isLive, planLabel } from "@/lib/subscriptions";
import { startCheckoutAction, manageBillingAction } from "./actions";
import type { Tech } from "@/lib/db/types";
import { launchOfferCopy, launchOfferEnabled, partnerOfferEnabled } from "@/lib/offers";

const APP_HOST = (process.env.NEXT_PUBLIC_APP_URL ?? "https://glow-uk.com").replace(/^https?:\/\//, "");

type BillingData = {
  referredCount: number;
  stripeConfigured?: boolean;
};

export default function BillingPage() {
  const { tech } = useDashboardAuth();
  if (!tech) return null;

  return (
    <AsyncDashboardPage<BillingData> pageKey="billing">
      {(data) => (
        <BillingView
          tech={tech}
          referredCount={data.referredCount}
          configured={data.stripeConfigured ?? false}
        />
      )}
    </AsyncDashboardPage>
  );
}

function BillingView({
  tech,
  referredCount,
  configured,
}: {
  tech: Tech;
  referredCount: number;
  configured: boolean;
}) {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const welcome = searchParams.get("welcome") === "1";
  const live = isLive(tech);
  const isTester = tech.signupOffer === "tester";
  const isPartner = !!tech.signupPartnerSlug && partnerOfferEnabled();
  const offer = launchOfferCopy(isTester);
  const monthlyPrice = isTester ? "£1" : isPartner ? "£0" : launchOfferEnabled() ? "£9.50" : "£19";
  const monthlyCadence = isTester
    ? " first month, then £19/mo"
    : isPartner
      ? " for 3 months, then £19/mo"
      : launchOfferEnabled()
        ? " first month, then £19/mo"
        : "/mo";
  const monthlyNote = isTester
    ? "Tester offer"
    : isPartner
      ? "Partner: 3 months free"
      : launchOfferEnabled()
        ? "50% off first month"
        : "Everything included";
  const monthlyButton = isTester
    ? "Go live for £1"
    : isPartner
      ? "Go live — 3 months free"
      : launchOfferEnabled()
        ? "Go live for £9.50"
        : "Go live for £19";
  const footerNote = isTester
    ? "Tester offer: first month £1, then £19/mo. Cancel anytime."
    : isPartner
      ? "Partner offer: 3 months free, then £19/mo. Cancel anytime."
      : launchOfferEnabled()
        ? "50% off your first month on the monthly plan, then £19/mo. Cancel anytime."
        : "£19/mo on the monthly plan. Cancel anytime.";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">My plan</h1>
        <p className="text-sm text-ink-soft">Your Glow membership. 0% commission - you keep every penny your clients pay you.</p>
      </div>

      {welcome && !live && (
        <div className="flex items-center gap-2 rounded-xl bg-brand-500/10 px-4 py-3 text-sm text-brand-text">
          <Sparkles className="h-4 w-4" /> Account created! Activate your plan below to unlock your tools and switch on bookings.
        </div>
      )}
      {status === "started" && (
        <div className="flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">
          <CheckCircle2 className="h-4 w-4" /> Card saved - your subscription is being activated. This can take a few seconds.
        </div>
      )}
      {isTester && !live && (
        <div className="rounded-2xl border-2 border-brand-400 bg-gradient-to-r from-brand-600 to-brand-700 p-5 text-center text-white shadow-glow">
          <p className="font-display text-lg font-semibold">Tester offer active</p>
          <p className="mt-1 text-3xl font-bold">First month £1</p>
          <p className="mt-1 text-sm text-white/85">
            Then £19/mo, cancel anytime. Pick Monthly below - the £1 shows at checkout. Thanks for helping test Glow!
          </p>
        </div>
      )}
      {isPartner && !isTester && !live && (
        <div className="rounded-2xl border-2 border-brand-400 bg-gradient-to-r from-brand-600 to-brand-700 p-5 text-center text-white shadow-glow">
          <p className="font-display text-lg font-semibold">Partner offer active</p>
          <p className="mt-1 text-3xl font-bold">3 months free</p>
          <p className="mt-1 text-sm text-white/85">
            Then £19/mo, cancel anytime. Pick Monthly below to activate.
          </p>
        </div>
      )}
      {status === "cancelled" && (
        <div className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-text">Checkout cancelled - no charge was made.</div>
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
            <div className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-text">
              Payments aren&apos;t configured on this environment yet.
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <PlanCard
              title="Monthly"
              price={monthlyPrice}
              cadence={monthlyCadence}
              plan="monthly"
              configured={configured}
              highlight
              note={monthlyNote}
              buttonLabel={monthlyButton}
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
          <p className="text-center text-xs text-ink-faint">{footerNote}</p>
          {!isTester && !isPartner && launchOfferEnabled() ? (
            <p className="text-center text-xs text-ink-faint">
              Launch offer: {offer.firstMonthLabel} {offer.thenLabel}. Referral free-month credits apply from invoice 2 onward for the referrer.
            </p>
          ) : null}
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
            <code className="rounded-xl border border-edge bg-fill px-3 py-2 text-sm">
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

function PlanCard({ title, price, cadence, plan, configured, highlight, note, buttonLabel }: { title: string; price: string; cadence: string; plan: "monthly" | "annual"; configured: boolean; highlight?: boolean; note?: string; buttonLabel?: string; }) {
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
        <Button type="submit" className="w-full" disabled={!configured}>{buttonLabel ?? "Subscribe"}</Button>
      </form>
    </div>
  );
}
