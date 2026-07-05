-- PECR compliance: clients can opt out of marketing emails (rebooking nudges).
-- Service reminders (confirmations, 24h, balance) are unaffected.
alter table public.clients add column if not exists "marketingOptOut" boolean not null default false;
