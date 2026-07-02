import { redirect } from "next/navigation";
import { CheckCircle2, Wallet, AlertTriangle, Banknote } from "lucide-react";
import { getDashboardContext } from "@/lib/auth/session";
import { syncConnectStatus } from "@/lib/connect";
import { stripeConfigured } from "@/lib/stripe";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { connectStartAction } from "./actions";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; refresh?: string }>;
}) {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  const { sb, tech } = c;
  const sp = await searchParams;

  // On return from Stripe, pull the latest status.
  let chargesEnabled = tech.connectChargesEnabled;
  let detailsSubmitted = tech.connectDetailsSubmitted;
  let payoutsEnabled = tech.connectPayoutsEnabled;
  if ((sp.done || sp.refresh) && tech.stripeConnectAccountId && stripeConfigured()) {
    const flags = await syncConnectStatus(sb, tech);
    chargesEnabled = flags.chargesEnabled;
    detailsSubmitted = flags.detailsSubmitted;
    payoutsEnabled = flags.payoutsEnabled;
  }

  const connected = chargesEnabled && payoutsEnabled;
  const started = !!tech.stripeConnectAccountId;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Payments</h1>
        <p className="text-sm text-ink-soft">
          Connect your bank so client deposits pay straight to you. Glow takes 0% —
          only Stripe&apos;s standard card fee applies.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-brand-600" /> Payouts
            {connected ? (
              <Badge tone="green">Connected</Badge>
            ) : started ? (
              <Badge tone="amber">Setup incomplete</Badge>
            ) : (
              <Badge tone="neutral">Not connected</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {connected
              ? "You're all set to take deposits online."
              : "Link a Stripe account to accept online deposits."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!stripeConfigured() && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Payments aren&apos;t configured on this environment yet.
            </div>
          )}

          {connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Charges enabled
              </div>
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <Banknote className="h-4 w-4" /> Payouts to your bank enabled
              </div>
              <form action={connectStartAction}>
                <Button type="submit" variant="outline">Manage payout account</Button>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              {started && !detailsSubmitted && (
                <p className="flex items-center gap-2 text-sm text-amber-700">
                  <AlertTriangle className="h-4 w-4" /> Your Stripe setup isn&apos;t finished yet.
                </p>
              )}
              <form action={connectStartAction}>
                <Button type="submit" disabled={!stripeConfigured()}>
                  {started ? "Finish payout setup" : "Set up payouts"}
                </Button>
              </form>
              <p className="text-xs text-ink-faint">
                You&apos;ll be taken to Stripe to add your bank details and verify your
                identity. Takes a couple of minutes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-ink-soft">
          <p>· Clients pay their deposit when they book; it goes straight to your Stripe balance.</p>
          <p>· The remaining balance can be paid via a link, or in person on the day.</p>
          <p>· Stripe pays out to your bank on a rolling basis. Glow never touches your money.</p>
        </CardContent>
      </Card>
    </div>
  );
}
