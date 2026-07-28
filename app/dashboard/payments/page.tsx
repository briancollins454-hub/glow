import { redirect } from "next/navigation";
import { CheckCircle2, Wallet, AlertTriangle, Banknote } from "lucide-react";
import { getDashboardContext } from "@/lib/auth/session";
import { syncConnectStatus } from "@/lib/connect";
import { stripeConfigured } from "@/lib/stripe";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StripePaymentsLoginButton } from "@/components/dashboard/stripe-payments-login-button";
import { salonTakesClientPayments } from "@/lib/subscriptions";
import { connectStartAction } from "./actions";
import Link from "next/link";

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
  const takingClientPayments = salonTakesClientPayments(tech);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Get paid</h1>
        <p className="text-sm text-ink-soft">
          Set this up once and client deposits go straight to your bank. Glow takes 0% -
          only the card company&apos;s standard fee applies.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-brand-400" /> Card payments
            {connected ? (
              <Badge tone="green">All set</Badge>
            ) : started ? (
              <Badge tone="amber">Nearly there</Badge>
            ) : (
              <Badge tone="neutral">Not set up</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {connected
              ? "Stripe is connected. Connecting alone does not start charging clients — that is controlled in Settings → Take payments from clients."
              : "A quick one-time setup so clients can pay by card when you turn on client payments in Settings."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!stripeConfigured() && (
            <div className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-text">
              Payments aren&apos;t configured on this environment yet.
            </div>
          )}

          {connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-success-text">
                <CheckCircle2 className="h-4 w-4" /> Stripe account connected
              </div>
              <div className="flex items-center gap-2 text-sm text-success-text">
                <Banknote className="h-4 w-4" /> Money goes straight to your bank
              </div>
              {!takingClientPayments && (
                <div className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-text">
                  Client payments are turned off in{" "}
                  <Link href="/dashboard/settings" className="underline">
                    Settings
                  </Link>
                  . Clients can still book, but they won&apos;t be asked to pay online.
                </div>
              )}
              <StripePaymentsLoginButton />
              <form action={connectStartAction}>
                <Button type="submit" variant="outline">
                  Manage bank details
                </Button>
              </form>
              <p className="text-xs text-ink-faint">
                Your first payout from a new Stripe account usually takes 7 to 14 days. After that
                they arrive much faster.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {started && !detailsSubmitted && (
                <p className="flex items-center gap-2 text-sm text-warning-text">
                  <AlertTriangle className="h-4 w-4" /> You&apos;re part-way through - just pick up where you left off.
                </p>
              )}
              <form action={connectStartAction}>
                <Button type="submit" disabled={!stripeConfigured()}>
                  {started ? "Finish setting up" : "Set up card payments"}
                </Button>
              </form>
              <p className="text-xs text-ink-faint">
                You&apos;ll add your bank details and confirm who you are (standard for
                card payments - handled securely by Stripe). Takes a couple of minutes.
                Connecting Stripe alone does not start charging clients — turn on &ldquo;Take
                payments from clients&rdquo; in Settings when you&apos;re ready.
              </p>
              <p className="text-xs text-ink-faint">
                Your first payout from a new Stripe account usually takes 7 to 14 days. After that
                they arrive much faster.
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
          <p>· Clients pay their deposit by card when they book (when client payments are on).</p>
          <p>· The rest can be paid through a link before the day, or in person on the day.</p>
          <p>· The money lands in your bank automatically every few days. Glow never touches it.</p>
          <p>· Your first payout from a new Stripe account usually takes 7 to 14 days. After that they arrive much faster.</p>
        </CardContent>
      </Card>
    </div>
  );
}
