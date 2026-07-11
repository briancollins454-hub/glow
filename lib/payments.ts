import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import type { Booking, Service, Tech } from "@/lib/db/types";

// Client payments via Stripe Connect: deposits/balances are charged as DIRECT
// charges on the tech's connected account, so funds go straight to the tech.

function acct(tech: Tech): { stripeAccount: string } {
  if (!tech.stripeConnectAccountId) throw new Error("Tech has no connected account");
  return { stripeAccount: tech.stripeConnectAccountId };
}

export async function createDepositCheckout(
  tech: Tech,
  service: Service,
  booking: Booking,
  appUrl: string,
): Promise<string> {
  const s = stripe();
  const session = await s.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: booking.depositPennies,
            product_data: { name: `${service.name} - deposit` },
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/${tech.handle}/booked/${booking.balanceToken}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/${tech.handle}?service=${service.id}&err=payment_cancelled`,
      metadata: { bookingId: booking.id, kind: "deposit" },
      payment_intent_data: { metadata: { bookingId: booking.id, kind: "deposit" } },
    },
    acct(tech),
  );
  return session.url!;
}

export async function createBalanceCheckout(
  tech: Tech,
  service: Service,
  booking: Booking,
  appUrl: string,
): Promise<string> {
  const s = stripe();
  const session = await s.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: booking.balancePennies,
            product_data: { name: `${service.name} - balance` },
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/pay/${booking.balanceToken}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pay/${booking.balanceToken}`,
      metadata: { bookingId: booking.id, kind: "balance" },
      payment_intent_data: { metadata: { bookingId: booking.id, kind: "balance" } },
    },
    acct(tech),
  );
  return session.url!;
}

/** Retrieve a Checkout session on the connected account (to verify on return). */
export async function retrieveCheckout(
  tech: Tech,
  sessionId: string,
): Promise<Stripe.Checkout.Session | null> {
  try {
    const s = stripe();
    return await s.checkout.sessions.retrieve(sessionId, undefined, acct(tech));
  } catch {
    return null;
  }
}

export type CheckoutConfirmResult = {
  paid: boolean;
  paymentIntentId: string;
  bookingId: string;
  kind: string;
  amountTotal: number | null;
};

/**
 * Verify a Checkout was paid, retrying briefly to absorb the moment between the
 * client redirect and Stripe finalizing the session. Returns payment intent plus
 * session metadata so callers can confirm the session belongs to this booking.
 */
export async function confirmCheckoutPaid(
  tech: Tech,
  sessionId: string,
  attempts = 5,
): Promise<CheckoutConfirmResult> {
  for (let i = 0; i < attempts; i++) {
    const session = await retrieveCheckout(tech, sessionId);
    if (session?.payment_status === "paid") {
      const pi =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? "";
      return {
        paid: true,
        paymentIntentId: pi,
        bookingId: session.metadata?.bookingId ?? "",
        kind: session.metadata?.kind ?? "",
        amountTotal: session.amount_total ?? null,
      };
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 800));
  }
  return { paid: false, paymentIntentId: "", bookingId: "", kind: "", amountTotal: null };
}

/** True when a paid Checkout session matches this booking's deposit. */
export function checkoutMatchesDeposit(
  result: CheckoutConfirmResult,
  booking: Pick<Booking, "id" | "depositPennies">,
): boolean {
  return (
    result.paid &&
    result.bookingId === booking.id &&
    result.kind === "deposit" &&
    result.amountTotal === booking.depositPennies
  );
}

/** True when a paid Checkout session matches this booking's balance. */
export function checkoutMatchesBalance(
  result: CheckoutConfirmResult,
  booking: Pick<Booking, "id" | "balancePennies">,
): boolean {
  return (
    result.paid &&
    result.bookingId === booking.id &&
    result.kind === "balance" &&
    result.amountTotal === booking.balancePennies
  );
}

/** Refund a payment on the connected account (e.g. genuine cancellation). */
export async function refundOnConnect(
  tech: Tech,
  paymentIntentId: string,
): Promise<void> {
  const s = stripe();
  await s.refunds.create({ payment_intent: paymentIntentId }, acct(tech));
}
