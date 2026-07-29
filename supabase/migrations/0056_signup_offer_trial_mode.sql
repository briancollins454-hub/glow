-- Platform signup offer mode (trial vs half-price first month) + trial fields.
-- Mode is stored in DB so the owner can change it without a deploy.
-- Each tech freezes their offer at signup; changing the platform setting
-- never rewrites existing accounts.

create table if not exists public.platform_settings (
  key text primary key,
  value text not null,
  "updatedAt" timestamptz not null default now(),
  "updatedByTechId" text,
  "updatedByEmail" text
);

alter table public.platform_settings enable row level security;

insert into public.platform_settings (key, value)
values ('signupOfferMode', 'half_price_first_month')
on conflict (key) do nothing;

comment on table public.platform_settings is
  'Owner-only platform knobs. signupOfferMode: trial | half_price_first_month.';

alter table public.techs
  add column if not exists "trialEndsAt" timestamptz,
  add column if not exists "trialWarningDay7SentAt" timestamptz,
  add column if not exists "trialWarningDay11SentAt" timestamptz,
  add column if not exists "trialWarningDay13SentAt" timestamptz,
  add column if not exists "trialFirstChargeEmailSentAt" timestamptz,
  add column if not exists "trialPastDueWarnedAt" timestamptz,
  add column if not exists "bookingPageOfflineWarnedAt" timestamptz;

comment on column public.techs."trialEndsAt" is
  'When the frozen trial ends (signupOffer=trial). Null for non-trial signups.';

-- Idempotent Stripe webhook processing (safe under duplicate delivery).
create table if not exists public.stripe_webhook_events (
  "eventId" text primary key,
  type text not null,
  "processedAt" timestamptz not null default now(),
  "techId" text
);

create index if not exists idx_stripe_webhook_events_processed
  on public.stripe_webhook_events ("processedAt");

alter table public.stripe_webhook_events enable row level security;
