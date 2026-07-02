// Creates the Stripe webhook endpoint for the deployed app and prints its
// signing secret. Run: node scripts/stripe-webhook.mjs <appUrl>
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
const appUrl = process.argv[2] || process.env.NEXT_PUBLIC_APP_URL;
if (!key || !appUrl) {
  console.error("Need STRIPE_SECRET_KEY env and app URL arg");
  process.exit(1);
}
const stripe = new Stripe(key);

const url = `${appUrl.replace(/\/$/, "")}/api/stripe/webhook`;

const endpoint = await stripe.webhookEndpoints.create({
  url,
  enabled_events: [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ],
});

console.log(`\nWebhook endpoint: ${endpoint.url}`);
console.log(`STRIPE_WEBHOOK_SECRET=${endpoint.secret}`);
