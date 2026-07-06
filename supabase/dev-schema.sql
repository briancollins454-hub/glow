-- =============================================================================
-- Glow - LOCAL DEV schema (Cursor Cloud environment setup)
-- =============================================================================
-- The committed supabase/migrations chain does not apply from scratch:
-- 0001_init.sql defines a snake_case / uuid-id schema, while 0002+ migrations and
-- the application runtime (lib/db/queries.ts, lib/db/types.ts, scripts/seed.mjs)
-- all use a camelCase / text-id schema (and the table is `categories`, not
-- `service_categories`). Several columns the app relies on (Stripe billing /
-- Connect) are not added by any migration either.
--
-- This file is the single source of truth for the LOCAL dev database. It is loaded
-- by `supabase db reset` / `supabase start` via [db.seed] in config.toml (the
-- migration runner is disabled there). It mirrors lib/db/types.ts.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- techs (one row per self-employed beauty tech; maps to auth.users.id)
-- ---------------------------------------------------------------------------
create table if not exists public.techs (
  id text primary key,
  "authUserId" uuid unique references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null default '',
  handle text not null unique,
  "businessName" text not null default '',
  bio text not null default '',
  "brandColor" text not null default '#db2777',
  instagram text not null default '',
  tiktok text not null default '',
  location text not null default '',
  "defaultDepositPct" integer not null default 30,
  "cancellationWindowHours" integer not null default 48,
  "noShowFeePct" integer not null default 100,
  -- Stripe Billing (platform subscription)
  "stripeCustomerId" text,
  "stripeSubscriptionId" text,
  "subscriptionStatus" text not null default 'none',
  plan text,
  "currentPeriodEnd" timestamptz,
  -- Stripe Connect (client deposits pay out to the tech)
  "stripeConnectAccountId" text,
  "connectChargesEnabled" boolean not null default false,
  "connectPayoutsEnabled" boolean not null default false,
  "connectDetailsSubmitted" boolean not null default false,
  -- Self-serve password reset
  "resetTokenHash" text,
  "resetTokenExpiresAt" timestamptz,
  -- Referral attribution
  "referredBy" text,
  -- Loyalty rewards
  "loyaltyVisitThreshold" integer not null default 0,
  "loyaltyDiscountPct" integer not null default 0,
  -- Private calendar feed token
  "calendarToken" text,
  -- Account closure / deletion request tracking
  "closureRequestedAt" timestamptz,
  "closureReason" text not null default '',
  -- Direct Google Calendar sync
  "googleRefreshToken" text,
  "googleCalendarId" text,
  "googleCalendarEmail" text,
  "googleConnectedAt" timestamptz,
  "createdAt" timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- categories (patch-test rule defaults per category)
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id text primary key,
  "techId" text not null references public.techs (id) on delete cascade,
  name text not null,
  "patchTestValidityDays" integer not null default 180,
  "patchTestMinLeadHours" integer not null default 24,
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_categories_tech on public.categories ("techId");

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------
create table if not exists public.services (
  id text primary key,
  "techId" text not null references public.techs (id) on delete cascade,
  "categoryId" text not null references public.categories (id) on delete cascade,
  name text not null,
  description text not null default '',
  "durationMin" integer not null,
  "pricePennies" integer not null,
  "depositType" text not null default 'percent',
  "depositValue" integer not null default 30,
  "requiresPatchTest" boolean not null default false,
  "isInfill" boolean not null default false,
  "fullSetServiceId" text references public.services (id) on delete set null,
  "infillMaxGapDays" integer not null default 21,
  active boolean not null default true,
  "sortOrder" integer not null default 0,
  "photoPath" text,
  "aftercareText" text not null default '',
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_services_tech on public.services ("techId");

-- ---------------------------------------------------------------------------
-- availability
-- ---------------------------------------------------------------------------
create table if not exists public.working_hours (
  id text primary key,
  "techId" text not null references public.techs (id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  "startMinutes" integer not null,
  "endMinutes" integer not null,
  "lastStartMinutes" integer,
  enabled boolean not null default true
);
create index if not exists idx_working_hours_tech on public.working_hours ("techId");

create table if not exists public.time_off (
  id text primary key,
  "techId" text not null references public.techs (id) on delete cascade,
  "startIso" timestamptz not null,
  "endIso" timestamptz not null,
  reason text not null default ''
);
create index if not exists idx_time_off_tech on public.time_off ("techId");

-- ---------------------------------------------------------------------------
-- clients (with blacklist / warning notes)
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id text primary key,
  "techId" text not null references public.techs (id) on delete cascade,
  name text not null,
  email text not null default '',
  phone text not null default '',
  notes text not null default '',
  "isBlacklisted" boolean not null default false,
  "warningNote" text not null default '',
  "noShowCount" integer not null default 0,
  "isVip" boolean not null default false,
  "messageToken" text not null default replace(gen_random_uuid()::text, '-', ''),
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_clients_tech on public.clients ("techId");
create unique index if not exists idx_clients_message_token on public.clients ("messageToken");

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
create table if not exists public.bookings (
  id text primary key,
  "techId" text not null references public.techs (id) on delete cascade,
  "clientId" text not null references public.clients (id) on delete cascade,
  "serviceId" text not null references public.services (id) on delete restrict,
  "startIso" timestamptz not null,
  "endIso" timestamptz not null,
  status text not null default 'confirmed',
  "pricePennies" integer not null,
  "depositPennies" integer not null default 0,
  "depositStatus" text not null default 'none',
  "balancePennies" integer not null default 0,
  "balanceStatus" text not null default 'none',
  "balanceToken" text not null unique,
  "isPatchTest" boolean not null default false,
  notes text not null default '',
  "lashMap" text not null default '',
  "lashCurl" text not null default '',
  "lashLength" text not null default '',
  addons jsonb not null default '[]'::jsonb,
  "discountPennies" integer not null default 0,
  "googleEventId" text,
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_bookings_tech on public.bookings ("techId");
create index if not exists idx_bookings_client on public.bookings ("clientId");
create index if not exists idx_bookings_start on public.bookings ("startIso");
create index if not exists idx_bookings_google_event on public.bookings ("googleEventId");

-- ---------------------------------------------------------------------------
-- payments (deposit / balance / refund)
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id text primary key,
  "techId" text not null references public.techs (id) on delete cascade,
  "bookingId" text not null references public.bookings (id) on delete cascade,
  kind text not null,
  "amountPennies" integer not null,
  status text not null default 'succeeded',
  provider text not null default 'stub',
  "providerRef" text not null default '',
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_payments_tech on public.payments ("techId");

-- ---------------------------------------------------------------------------
-- patch_tests
-- ---------------------------------------------------------------------------
create table if not exists public.patch_tests (
  id text primary key,
  "techId" text not null references public.techs (id) on delete cascade,
  "clientId" text not null references public.clients (id) on delete cascade,
  "categoryId" text not null references public.categories (id) on delete cascade,
  "performedAtIso" timestamptz not null,
  "expiresAtIso" timestamptz not null,
  result text not null default 'pending',
  "bookingId" text references public.bookings (id) on delete set null,
  notes text not null default '',
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_patch_tests_client on public.patch_tests ("clientId");

-- ---------------------------------------------------------------------------
-- reminders
-- ---------------------------------------------------------------------------
create table if not exists public.reminders (
  id text primary key,
  "techId" text not null references public.techs (id) on delete cascade,
  "bookingId" text not null references public.bookings (id) on delete cascade,
  channel text not null,
  kind text not null,
  "sendAtIso" timestamptz not null,
  status text not null default 'scheduled',
  preview text not null default '',
  "sentAtIso" timestamptz,
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_reminders_due on public.reminders (status, "sendAtIso");

-- ---------------------------------------------------------------------------
-- messaging (migration 0002)
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id text primary key,
  "techId" text not null references public.techs(id) on delete cascade,
  "clientId" text not null references public.clients(id) on delete cascade,
  sender text not null check (sender in ('tech','client')),
  body text not null,
  "readAt" timestamptz,
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_messages_tech on public.messages("techId");
create index if not exists idx_messages_client on public.messages("clientId", "createdAt");

-- ---------------------------------------------------------------------------
-- onboarding email drip (migration 0004)
-- ---------------------------------------------------------------------------
create table if not exists public.onboarding_emails (
  id text primary key,
  "techId" text not null references public.techs(id) on delete cascade,
  kind text not null,
  "sendAtIso" timestamptz not null,
  status text not null default 'scheduled',
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_onboarding_due on public.onboarding_emails(status, "sendAtIso");

-- ---------------------------------------------------------------------------
-- service add-ons (migration 0005)
-- ---------------------------------------------------------------------------
create table if not exists public.service_addons (
  id text primary key,
  "techId" text not null references public.techs(id) on delete cascade,
  "serviceId" text not null references public.services(id) on delete cascade,
  name text not null,
  "pricePennies" integer not null default 0,
  active boolean not null default true,
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_addons_service on public.service_addons("serviceId");

-- ---------------------------------------------------------------------------
-- consultation forms / photos / audit / closure (migration 0008)
-- ---------------------------------------------------------------------------
create table if not exists public.consultation_questions (
  id text primary key,
  "techId" text not null,
  prompt text not null,
  type text not null check (type in ('text', 'longtext', 'yesno')),
  required boolean not null default false,
  "sortOrder" integer not null default 0,
  active boolean not null default true,
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_questions_tech on public.consultation_questions("techId");

create table if not exists public.form_responses (
  id text primary key,
  "techId" text not null,
  "clientId" text not null,
  "bookingId" text,
  answers jsonb not null default '[]'::jsonb,
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_form_responses_client on public.form_responses("clientId", "createdAt");

create table if not exists public.client_photos (
  id text primary key,
  "techId" text not null,
  "clientId" text not null,
  "bookingId" text,
  path text not null,
  kind text not null default 'other' check (kind in ('before', 'after', 'other')),
  consent boolean not null default false,
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_client_photos_client on public.client_photos("clientId", "createdAt");

create table if not exists public.audit_events (
  id text primary key,
  "techId" text not null,
  actor text not null default 'tech',
  action text not null,
  "entityType" text not null,
  "entityId" text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_audit_events_tech on public.audit_events("techId", "createdAt");

create table if not exists public.account_closure_requests (
  id text primary key,
  "techId" text not null,
  reason text not null default '',
  status text not null default 'requested' check (status in ('requested', 'processing', 'completed', 'cancelled')),
  "requestedAt" timestamptz not null default now(),
  "completedAt" timestamptz
);
create index if not exists idx_closure_requests_tech on public.account_closure_requests("techId", "requestedAt");

-- ---------------------------------------------------------------------------
-- Row Level Security: every table is scoped to the owning tech.
-- ---------------------------------------------------------------------------
create or replace function public.current_tech_id()
returns text
language sql stable
as $$
  select id from public.techs where "authUserId" = auth.uid()
$$;

alter table public.techs enable row level security;
drop policy if exists techs_self on public.techs;
create policy techs_self on public.techs
  for all using ("authUserId" = auth.uid())
  with check ("authUserId" = auth.uid());

-- Per-tech ownership policies for every table that carries a "techId".
do $$
declare
  t text;
begin
  foreach t in array array[
    'categories','services','working_hours','time_off','clients','bookings',
    'payments','patch_tests','reminders','messages','service_addons',
    'consultation_questions','form_responses','client_photos','audit_events',
    'account_closure_requests'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %1$s_owner on public.%1$s;', t);
    execute format(
      'create policy %1$s_owner on public.%1$s for all using ("techId" = public.current_tech_id()) with check ("techId" = public.current_tech_id());',
      t
    );
  end loop;
end $$;

-- Service-role only (no anon/authenticated policy): reminder + onboarding drips.
alter table public.onboarding_emails enable row level security;

-- ---------------------------------------------------------------------------
-- Data API grants (PostgREST roles). RLS still scopes rows for anon/authenticated;
-- the service_role bypasses RLS for public booking pages, cron and admin tasks.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;

notify pgrst, 'reload schema';
