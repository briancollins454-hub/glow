"use server";

import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/session";
import { ensureConnectAccount, createOnboardingLink, createExpressLoginLink } from "@/lib/connect";
import { stripeErrorMessage } from "@/lib/stripe-errors";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function connectStartAction() {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  const accountId = await ensureConnectAccount(c.sb, c.tech);
  const url = await createOnboardingLink(accountId, APP_URL);
  redirect(url);
}

/**
 * Fresh Express login link for the signed-in tech's own connected account only.
 * Never accepts another account id from the client.
 */
export async function openStripePaymentsAction(): Promise<
  { url: string } | { error: string; needsConnect?: boolean }
> {
  const c = await getDashboardContext();
  if (!c) return { error: "Please sign in again." };

  const accountId = c.tech.stripeConnectAccountId;
  if (!accountId) {
    return {
      error: "Connect Stripe first to view your payments.",
      needsConnect: true,
    };
  }

  try {
    // Always the session tech's account — never an id from the form.
    const url = await createExpressLoginLink(accountId);
    return { url };
  } catch (err) {
    console.error("[openStripePaymentsAction]", err);
    return {
      error: stripeErrorMessage(err, "Couldn't open Stripe right now. Please try again."),
    };
  }
}
