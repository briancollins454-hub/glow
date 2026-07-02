import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const customer = process.argv[2];

const subs = await stripe.subscriptions.list({ customer, limit: 5 });
console.log("subscriptions:", subs.data.map((s) => ({ id: s.id, status: s.status })));

const scheds = await stripe.subscriptionSchedules.list({ customer, limit: 5 });
console.log("schedules:", scheds.data.map((s) => ({ id: s.id, status: s.status })));

const events = await stripe.events.list({ limit: 8 });
console.log("recent events:", events.data.map((e) => e.type));

const endpoints = await stripe.webhookEndpoints.list({ limit: 5 });
console.log("webhook endpoints:", endpoints.data.map((e) => ({ url: e.url, status: e.status })));
