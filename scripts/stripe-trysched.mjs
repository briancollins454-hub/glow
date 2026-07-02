import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const customer = process.argv[2];
try {
  const schedule = await stripe.subscriptionSchedules.create({
    customer,
    start_date: "now",
    end_behavior: "release",
    phases: [
      { items: [{ price: "price_1ToiJMDZLyVjhcGjEJasQFhB", quantity: 1 }], end_date: Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60 },
      { items: [{ price: "price_1ToiJNDZLyVjhcGjVu6W0PUt", quantity: 1 }] },
    ],
  });
  console.log("OK schedule:", schedule.id, "sub:", schedule.subscription);
} catch (e) {
  console.log("ERROR:", e.message);
}
