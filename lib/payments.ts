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

/**
 * Card capture: save the client's card without charging anything (Checkout
 * setup mode on the connected account), so a no-show fee can be charged later.
 */
export async function createCardCaptureCheckout(
  tech: Tech,
  service: Service,
  booking: Booking,
  client: { name: string; email: string },
  appUrl: string,
): Promise<string> {
  const s = stripe();
  // Explicit customer so the saved payment method is attached and reusable.
  const customer = await s.customers.create(
    { name: client.name, email: client.email, metadata: { bookingId: booking.id } },
    acct(tech),
  );
  const session = await s.checkout.sessions.create(
    {
      mode: "setup",
      customer: customer.id,
      currency: "gbp",
      payment_method_types: ["card"],
      custom_text: {
        submit: {
          message:
            "Nothing is charged today. Your card is saved securely to hold the booking; a no-show fee may be charged if you miss your appointment.",
        },
      },
      success_url: `${appUrl}/${tech.handle}/booked/${booking.balanceToken}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/${tech.handle}?service=${service.id}&err=payment_cancelled`,
      metadata: { bookingId: booking.id, kind: "card_capture" },
      setup_intent_data: { metadata: { bookingId: booking.id, kind: "card_capture" } },
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

export type SetupConfirmResult = {
  complete: boolean;
  bookingId: string;
  kind: string;
  customerId: string;
  paymentMethodId: string;
};

/**
 * Verify a setup-mode Checkout completed (card saved), retrying briefly like
 * confirmCheckoutPaid. Returns the saved customer + payment method ids.
 */
export async function confirmCheckoutSetup(
  tech: Tech,
  sessionId: string,
  attempts = 5,
): Promise<SetupConfirmResult> {
  const empty: SetupConfirmResult = {
    complete: false,
    bookingId: "",
    kind: "",
    customerId: "",
    paymentMethodId: "",
  };
  for (let i = 0; i < attempts; i++) {
    const session = await retrieveCheckout(tech, sessionId);
    if (session?.mode === "setup" && session.status === "complete") {
      const setupIntentId =
        typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent?.id;
      if (!setupIntentId) return empty;
      const s = stripe();
      const si = await s.setupIntents.retrieve(setupIntentId, undefined, acct(tech)).catch(() => null);
      const paymentMethodId =
        typeof si?.payment_method === "string" ? si.payment_method : si?.payment_method?.id ?? "";
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id ?? "";
      if (paymentMethodId && customerId) {
        return {
          complete: true,
          bookingId: session.metadata?.bookingId ?? "",
          kind: session.metadata?.kind ?? "",
          customerId,
          paymentMethodId,
        };
      }
      return empty;
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 800));
  }
  return empty;
}

/**
 * Charge a no-show fee against the card saved at booking (off-session). The
 * client's bank can decline or demand authentication, so failure is a normal
 * outcome the caller must surface, not an exception.
 */
export async function chargeNoShowFee(
  tech: Tech,
  booking: Pick<Booking, "id" | "cardCustomerId" | "cardPaymentMethodId">,
  amountPennies: number,
): Promise<{ ok: boolean; paymentIntentId: string; error?: string }> {
  if (!booking.cardCustomerId || !booking.cardPaymentMethodId) {
    return { ok: false, paymentIntentId: "", error: "No saved card" };
  }
  const s = stripe();
  try {
    const pi = await s.paymentIntents.create(
      {
        amount: amountPennies,
        currency: "gbp",
        customer: booking.cardCustomerId,
        payment_method: booking.cardPaymentMethodId,
        off_session: true,
        confirm: true,
        description: "No-show fee",
        metadata: { bookingId: booking.id, kind: "no_show_fee" },
      },
      acct(tech),
    );
    if (pi.status === "succeeded") return { ok: true, paymentIntentId: pi.id };
    return { ok: false, paymentIntentId: pi.id, error: `Payment ${pi.status}` };
  } catch (err) {
    const e = err as { message?: string; raw?: { payment_intent?: { id?: string } } };
    return {
      ok: false,
      paymentIntentId: e.raw?.payment_intent?.id ?? "",
      error: e.message ?? "Charge failed",
    };
  }
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
