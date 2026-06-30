# Glow — booking for UK solo beauty techs

A fee-free, branded booking platform built for self-employed lash, nail and brow
techs. Deposits and no-show protection, patch-test tracking, lash/nail/brow
infill timing rules, automatic reminders, a "pay remaining balance" link, a
client blacklist/warning system, simple tax/income reports, and a branded public
booking page you can drop in your Instagram/TikTok bio — no marketplace, no
commission.

## Tech stack

- **Next.js (App Router)** + TypeScript + Tailwind CSS
- **Data layer** behind a swappable repository (`lib/db`). The MVP runs on a
  local JSON store (`.data/db.json`) seeded with a demo studio; production swaps
  it for **Supabase** (Postgres/Auth/Storage) — see `supabase/migrations`.
- **Payments & notifications** are stubbed behind interfaces (`lib/payments.ts`,
  `lib/notify.ts`) so the app runs with zero paid accounts. Phase D swaps in
  **Stripe Connect**, **Resend** (email) and **Twilio** (SMS).
- **Vercel Cron** drives the reminder scheduler (`vercel.json`).

## Getting started

```bash
npm install
cp .env.example .env.local   # optional for the local MVP
npm run dev
```

Open http://localhost:3000.

### Demo login

- Dashboard: **demo@glow.app** / **password123**
- Public booking page: **/bellarose**
- Pay-a-balance link example is shown on the booking confirmation screen.

The first run seeds a demo studio (Bella Rose Beauty) with services, clients,
bookings, a patch test and reminders. Reset it anytime from
**Dashboard → Settings → Reset demo data**.

## Key flows

- **Public booking** (`/[handle]`): pick a service → real availability slots →
  details → deposit (stubbed) → confirmation. The rules engine blocks bookings
  that need a valid patch test, restricts infills to returning clients within the
  rebooking window, and blocks blacklisted clients.
- **Dashboard**: overview, calendar with status changes (confirm / complete /
  cancel / no-show, with deposit-forfeit + no-show flagging), services & deposit
  config, availability, clients with patch tests and blacklist, reminders preview,
  and tax/income reports with CSV export.

## How the rules engine works

- **Patch test** (`lib/rules.ts → checkPatchTest`): a service flagged
  `requiresPatchTest` needs a `pass` patch test in the same category, performed at
  least the category's `min lead hours` before the appointment and not expired.
- **Infill timing** (`checkInfill`): an `isInfill` service requires a prior
  completed/confirmed appointment in the same category within
  `infillMaxGapDays`; otherwise the client is nudged to book a full set.
- **No-show protection**: cancellations inside the tech's window forfeit the
  deposit; no-shows forfeit the deposit and increment the client's no-show count.

## Going live (Phase D)

1. Provision a Supabase project and run `supabase/migrations/0001_init.sql`.
2. Reimplement `lib/db/repo.ts` against `supabase-js` (same function signatures).
3. Set the env vars in `.env.example` and switch `lib/payments.ts` /
   `lib/notify.ts` to Stripe / Resend / Twilio.
4. Deploy to Vercel; the cron in `vercel.json` runs the reminder scheduler.

> The local JSON store is for development/demo only — serverless filesystems are
> ephemeral, which is why production uses Supabase.
