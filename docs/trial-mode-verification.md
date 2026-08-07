# Trial mode verification checklist (Stripe test mode)

Run this **before** switching `signupOfferMode` to `trial` in production.
Default remains `half_price_first_month` so deploy alone changes nothing.

## Prerequisites

1. Apply migration `0056_signup_offer_trial_mode.sql` in Supabase (SQL editor / migrate).
2. Stripe test mode keys in the environment (`STRIPE_SECRET_KEY`, price IDs, webhook secret).
3. Webhook endpoint receiving at least:
   - `checkout.session.completed`
   - `customer.subscription.created` / `updated` / `deleted` / `trial_will_end`
   - `invoice.payment_succeeded` / `invoice.payment_failed`
4. Owner login as `brian@thesupportsdesk.com` (only account that can open **Admin → Signup offer**).

## A. Platform setting (owner only)

1. As owner, open `/dashboard/admin/offers`.
2. Confirm current mode is `half_price_first_month`.
3. Switch to `trial`, type `yes`, save.
4. Confirm audit / success message shows from → to.
5. As a non-owner tech or staff, confirm `/dashboard/admin/offers` is not reachable (404).
6. Confirm marketing CTAs now say **Try Glow free for 14 days** on `/`, `/pricing`, `/signup`.

## B. Half-price path (regression)

1. Set mode back to `half_price_first_month`.
2. Create a fresh signup.
3. Confirm tech.signupOffer is `half_price` (Admin → Accounts).
4. Start monthly Checkout — amount due today is **£9.50**, no trial.
5. Complete payment — status `active`, no `trialEndsAt`.

## C. Trial signup + card capture

1. Set mode to `trial`.
2. Create a fresh signup (not partner).
3. Confirm tech.signupOffer is `trial` and frozen (does not change if you flip the platform mode later).
4. Start monthly Checkout:
   - Mode is subscription with **14-day trial**
   - Card is required (`payment_method_collection: always`)
   - Amount due today is **£0**
   - No half-price coupon on the session
5. Complete Checkout with a test card (`4242…`).
6. Confirm `subscriptionStatus = trialing`, `trialEndsAt` ~ now + 14 days.
7. Dashboard shows trial banner with days remaining and first charge **£19** on that date.

## D. Offer freeze (critical)

1. While a trial account exists, flip platform mode to `half_price_first_month`.
2. Confirm that trial account still shows trial copy on Billing and still has `signupOffer = trial`.
3. New signups after the flip get `half_price` only.

## E. Trial lifecycle emails (cron)

1. With a trialing tech, either wait or adjust `trialEndsAt` in the DB for test.
2. Run reminders cron (Ops → run reminders, or wait for schedule).
3. Confirm emails:
   - Day 7 halfway
   - Day 11 (3 days before) with cancel link
   - Day 13 (1 day before) more prominent
4. Sending twice does not duplicate (stamps on the tech row).

## F. Cancel during trial = zero charge (explicit)

1. Create a trial subscription in Stripe test mode (or via app Checkout).
2. On **day 13** (use a [Stripe Test Clock](https://docs.stripe.com/billing/testing/test-clocks)):
   - Attach the customer to a test clock at signup time, or create clock + customer in Dashboard.
   - Advance the clock to day 13.
   - Cancel the subscription via Billing portal / Stripe Dashboard.
3. Advance the clock past day 14.
4. Confirm **no invoice is paid** / no £19 charge. Status `canceled`. Booking page offline via non-live status.

## G. Day-14 charge via Test Clock (required)

1. Create a **Test Clock** in Stripe Dashboard (Billing → Test clocks) or API.
2. Create customer on that clock with payment method `pm_card_visa` (success).
3. Create subscription: price £19/mo, `trial_period_days: 14`, `payment_method_collection: always`, `trial_settings.end_behavior.missing_payment_method = cancel`.
4. Advance clock to **trial end + 1 minute**.
5. Confirm Stripe generates and **pays** the first invoice for **£19**.
6. Confirm webhook sets tech to `active` and sends first-charge success email.
7. Optional automated live run: `RUN_STRIPE_TEST_CLOCKS=1 npm test -- tests/signup-offer-trial.test.ts`.

## H. Declined card at trial end (dunning)

1. Use test clock + card `4000000000000341` (charge fails) or attach a failing PM before trial end.
2. Advance past trial end.
3. Confirm:
   - `subscriptionStatus = past_due`
   - Failed first-charge email sent
   - Booking page **still online** during smart retries
   - Past-due dashboard banner shown
4. After retries exhausted / attempt ≥ 3:
   - Booking-offline **warning email** first
   - Only then `bookingPageLive = false`
5. Never offline without that prior email.

## I. Coupon + trial never stack

1. In trial mode, inspect Checkout session / subscription: **no** `first-month-50` coupon.
2. In half-price mode, confirm coupon applies and `trial_period_days` is absent.

## J. Webhook idempotency

1. Replay the same Stripe event (Dashboard → Webhooks → Resend).
2. Confirm handler returns `{ duplicate: true }` / no double emails / no double status flips.
3. Rows appear once in `stripe_webhook_events`.

## K. Admin Accounts

1. Open `/dashboard/admin/accounts`.
2. Confirm columns: signup offer, status (incl. trialing), trial end, days left, first charge.
3. Confirm summary **Accounts currently in trial**.

## L. Flip back before production enablement

1. Leave production on `half_price_first_month` until this checklist is green.
2. Only then set production to `trial` from the owner Signup offer page (no deploy required).
