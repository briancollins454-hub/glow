"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openStripePaymentsAction } from "@/app/dashboard/payments/actions";

/** Opens a fresh Stripe Express login link in a new tab (never caches the URL). */
export function StripePaymentsLoginButton() {
  const [error, setError] = useState("");
  const [needsConnect, setNeedsConnect] = useState(false);
  const [pending, startTransition] = useTransition();

  function onClick() {
    setError("");
    setNeedsConnect(false);
    startTransition(async () => {
      const result = await openStripePaymentsAction();
      if ("url" in result) {
        window.open(result.url, "_blank", "noopener,noreferrer");
        return;
      }
      setError(result.error);
      if (result.needsConnect) setNeedsConnect(true);
    });
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" onClick={onClick} disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Opening Stripe…
          </>
        ) : (
          <>
            <ExternalLink className="h-4 w-4" /> View my payments in Stripe
          </>
        )}
      </Button>
      <p className="text-xs text-ink-faint">
        Opens your own Stripe account, where you can see your payments and payouts. Money from
        clients goes straight to you, Glow never holds it.
      </p>
      {needsConnect ? (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-text">
          Connect Stripe first to view your payments. Use{" "}
          <span className="font-medium">Set up card payments</span> above, or go to{" "}
          <Link href="/dashboard/payments" className="underline">
            Get paid
          </Link>
          .
        </p>
      ) : error ? (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-text">{error}</p>
      ) : null}
    </div>
  );
}
