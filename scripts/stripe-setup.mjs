// Creates the Glow Billing products/prices in Stripe. Run once:
//   node scripts/stripe-setup.mjs
// Reads STRIPE_SECRET_KEY from .env.local or the environment.
// Prints the price IDs to paste into your env (STRIPE_PRICE_*).
import Stripe from "stripe";
import { readFileSync } from "node:fs";

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch {}
  return env;
}
const env = loadEnv();
const key = process.env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Missing STRIPE_SECRET_KEY");
  process.exit(1);
}
const stripe = new Stripe(key);

async function main() {
  const product = await stripe.products.create({
    name: "Glow",
    description: "Booking software for solo beauty techs.",
  });

  const trial = await stripe.prices.create({
    product: product.id,
    currency: "gbp",
    unit_amount: 200, // £2
    recurring: { interval: "day", interval_count: 14 },
    nickname: "Trial £2 / 14 days",
  });
  const monthly = await stripe.prices.create({
    product: product.id,
    currency: "gbp",
    unit_amount: 1900, // £19
    recurring: { interval: "month" },
    nickname: "Monthly £19",
  });
  const annual = await stripe.prices.create({
    product: product.id,
    currency: "gbp",
    unit_amount: 18000, // £180
    recurring: { interval: "year" },
    nickname: "Annual £180",
  });

  console.log("\nAdd these to your env (.env.local and Vercel):\n");
  console.log(`STRIPE_PRICE_TRIAL=${trial.id}`);
  console.log(`STRIPE_PRICE_MONTHLY=${monthly.id}`);
  console.log(`STRIPE_PRICE_ANNUAL=${annual.id}`);
  console.log(`\nProduct: ${product.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
