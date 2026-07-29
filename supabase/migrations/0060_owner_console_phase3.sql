-- Owner console Phase 3: outbound inspectability, webhooks, consent immutability, flags.

-- ── scheduled_sends enrichment ──────────────────────────────────────────────
alter table public.scheduled_sends
  add column if not exists channel text not null default 'email',
  add column if not exists "sourceTable" text,
  add column if not exists "sourceId" text,
  add column if not exists marketing boolean not null default false,
  add column if not exists "triggerLabel" text not null default '',
  add column if not exists "bodyPreview" text not null default '',
  add column if not exists subject text not null default '';

alter table public.scheduled_sends
  drop constraint if exists scheduled_sends_channel_chk;
alter table public.scheduled_sends
  add constraint scheduled_sends_channel_chk
  check (channel in ('email', 'sms'));

create unique index if not exists idx_scheduled_sends_source
  on public.scheduled_sends ("sourceTable", "sourceId")
  where "sourceTable" is not null and "sourceId" is not null;

-- ── Resend webhook event log ────────────────────────────────────────────────
create table if not exists public.resend_webhook_events (
  id text primary key,
  "svixId" text unique,
  type text not null,
  "emailId" text,
  ok boolean not null default true,
  error text,
  payload jsonb not null default '{}'::jsonb,
  "receivedAt" timestamptz not null default now(),
  "processedAt" timestamptz
);

create index if not exists idx_resend_webhook_received
  on public.resend_webhook_events ("receivedAt" desc);
alter table public.resend_webhook_events enable row level security;

-- ── Stripe webhook: store payload for replay ────────────────────────────────
alter table public.stripe_webhook_events
  add column if not exists payload jsonb,
  add column if not exists "signatureValid" boolean not null default true,
  add column if not exists "replayCount" integer not null default 0,
  add column if not exists error text;

-- ── Error grouping helpers ──────────────────────────────────────────────────
alter table public.platform_errors
  add column if not exists "resolvedAt" timestamptz,
  add column if not exists "resolvedBy" text,
  add column if not exists "techId" text;

create index if not exists idx_platform_errors_signature
  on public.platform_errors (signature, "createdAt" desc);

-- ── Consent records: immutable (no update/delete) ───────────────────────────
create or replace function public.consent_records_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'consent_records are immutable — never update or delete signed consents';
end;
$$;

drop trigger if exists trg_consent_records_no_mutate on public.consent_records;
create trigger trg_consent_records_no_mutate
  before update or delete on public.consent_records
  for each row execute function public.consent_records_immutable();

-- ── Feature flags (global + per-account) ────────────────────────────────────
create table if not exists public.feature_flags (
  key text primary key,
  description text not null default '',
  "enabledGlobal" boolean not null default false,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "updatedByEmail" text
);

create table if not exists public.feature_flag_overrides (
  id text primary key,
  key text not null references public.feature_flags(key) on delete cascade,
  "techId" text not null references public.techs(id) on delete cascade,
  enabled boolean not null,
  "updatedAt" timestamptz not null default now(),
  "updatedByEmail" text,
  unique (key, "techId")
);

alter table public.feature_flags enable row level security;
alter table public.feature_flag_overrides enable row level security;

insert into public.feature_flags (key, description, "enabledGlobal")
values
  ('waitlist_v2', 'Experimental waitlist UI', false),
  ('loyalty_v2', 'Loyalty programme v2', false),
  ('sms_marketing', 'SMS marketing nudges', false)
on conflict (key) do nothing;

-- ── Integration health snapshots (optional cache) ───────────────────────────
create table if not exists public.integration_health (
  provider text primary key,
  "lastSuccessAt" timestamptz,
  "lastErrorAt" timestamptz,
  "lastError" text,
  "successCount24h" integer not null default 0,
  "errorCount24h" integer not null default 0,
  "updatedAt" timestamptz not null default now()
);

alter table public.integration_health enable row level security;
