-- Web push notifications for techs (customer request).
-- Subscriptions are per device; prefs live on techs.pushPrefs (jsonb, null =
-- defaults) so the app keeps working before this migration runs.

create table if not exists public.push_subscriptions (
  id text primary key,
  "techId" text not null references public.techs(id) on delete cascade,
  "staffId" text,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  "userAgent" text not null default '',
  "createdAt" timestamptz not null default now(),
  "lastSeenAt" timestamptz not null default now(),
  "failureCount" integer not null default 0
);

create index if not exists idx_push_subscriptions_tech
  on public.push_subscriptions ("techId");
alter table public.push_subscriptions enable row level security;

comment on table public.push_subscriptions is
  'Web Push (VAPID) subscriptions, one row per device. 404/410 send responses delete the row; 5 consecutive other failures delete it too.';

-- Queued non-urgent pushes held back by a tech''s quiet hours; drained by the
-- reminders cron. Cancellations bypass this queue entirely.
create table if not exists public.push_queue (
  id text primary key,
  "techId" text not null references public.techs(id) on delete cascade,
  "staffId" text,
  payload jsonb not null,
  "sendAfterIso" timestamptz not null,
  "createdAt" timestamptz not null default now()
);

create index if not exists idx_push_queue_due
  on public.push_queue ("sendAfterIso");
alter table public.push_queue enable row level security;

alter table public.techs
  add column if not exists "pushPrefs" jsonb,
  add column if not exists "pushDailySummaryLastDate" text;

comment on column public.techs."pushPrefs" is
  'Per-type push toggles, quiet hours, daily summary time and the "also send by email" switch. Null = defaults (all types on, email on, quiet hours off).';
comment on column public.techs."pushDailySummaryLastDate" is
  'Salon-local calendar date (YYYY-MM-DD) the daily summary push was last sent, so the cron never double-sends.';
