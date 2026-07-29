-- Owner console Phase 1 foundation (and shared tables for later phases).
-- Extend existing platform_settings; do not break signupOfferMode.

-- ── techs: health, internal, tags, outbound pause ───────────────────────────
alter table public.techs
  add column if not exists "isInternal" boolean not null default false,
  add column if not exists "healthScore" smallint,
  add column if not exists "healthBand" text,
  add column if not exists "healthReasons" jsonb,
  add column if not exists "lastOwnerLoginAt" timestamptz,
  add column if not exists "atRiskManual" boolean not null default false,
  add column if not exists "ownerTags" text[] not null default '{}',
  add column if not exists "outboundPausedAt" timestamptz,
  add column if not exists "outboundPausedReason" text;

comment on column public.techs."isInternal" is
  'Test/staff account; excluded from owner metrics by default.';

create index if not exists idx_techs_is_internal on public.techs ("isInternal");
create index if not exists idx_techs_health_band on public.techs ("healthBand");

-- ── owner_settings (key/value kill switches + console prefs) ────────────────
create table if not exists public.owner_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  "updatedAt" timestamptz not null default now(),
  "updatedByEmail" text
);

alter table public.owner_settings enable row level security;

insert into public.owner_settings (key, value)
values
  ('signupsPaused', '{"paused":false}'::jsonb),
  ('allOutboundPaused', '{"paused":false}'::jsonb),
  ('marketingOutboundPaused', '{"paused":false}'::jsonb),
  ('cronPaused', '{"paused":false}'::jsonb),
  ('clientPaymentsPaused', '{"paused":false}'::jsonb),
  ('includeInternalInMetrics', '{"enabled":false}'::jsonb)
on conflict (key) do nothing;

-- ── immutable owner_audit ───────────────────────────────────────────────────
create table if not exists public.owner_audit (
  id text primary key,
  "actorEmail" text not null,
  action text not null,
  "targetType" text not null default 'tech',
  "targetId" text,
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now()
);

create index if not exists idx_owner_audit_actor on public.owner_audit ("actorEmail", "createdAt" desc);
create index if not exists idx_owner_audit_target on public.owner_audit ("targetId", "createdAt" desc);
create index if not exists idx_owner_audit_created on public.owner_audit ("createdAt" desc);

alter table public.owner_audit enable row level security;

-- Block updates/deletes (immutable). Inserts allowed for service role.
create or replace function public.owner_audit_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'owner_audit is immutable';
end;
$$;

drop trigger if exists trg_owner_audit_no_update on public.owner_audit;
create trigger trg_owner_audit_no_update
  before update or delete on public.owner_audit
  for each row execute function public.owner_audit_immutable();

-- ── owner_notes ─────────────────────────────────────────────────────────────
create table if not exists public.owner_notes (
  id text primary key,
  "techId" text not null references public.techs(id) on delete cascade,
  body text not null,
  "authorEmail" text not null,
  "createdAt" timestamptz not null default now()
);

create index if not exists idx_owner_notes_tech on public.owner_notes ("techId", "createdAt" desc);
alter table public.owner_notes enable row level security;

-- ── platform_events ─────────────────────────────────────────────────────────
create table if not exists public.platform_events (
  id text primary key,
  type text not null,
  "techId" text,
  severity text not null default 'info',
  title text not null,
  detail jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  constraint platform_events_severity_chk check (severity in ('info', 'warn', 'error'))
);

create index if not exists idx_platform_events_type on public.platform_events (type, "createdAt" desc);
create index if not exists idx_platform_events_tech on public.platform_events ("techId", "createdAt" desc);
create index if not exists idx_platform_events_created on public.platform_events ("createdAt" desc);
alter table public.platform_events enable row level security;

-- ── owner_alerts ────────────────────────────────────────────────────────────
create table if not exists public.owner_alerts (
  id text primary key,
  rule text not null,
  "techId" text,
  severity text not null default 'warn',
  title text not null,
  body text not null default '',
  "dismissedAt" timestamptz,
  "dismissedBy" text,
  "createdAt" timestamptz not null default now(),
  "alertDate" date not null default (timezone('utc', now()))::date
);

create unique index if not exists idx_owner_alerts_rule_tech_day
  on public.owner_alerts (rule, ("techId"), "alertDate");
create index if not exists idx_owner_alerts_open on public.owner_alerts ("createdAt" desc)
  where "dismissedAt" is null;
alter table public.owner_alerts enable row level security;

-- ── account_snapshots (daily) ───────────────────────────────────────────────
create table if not exists public.account_snapshots (
  id text primary key,
  "techId" text not null references public.techs(id) on delete cascade,
  "snapshotDate" date not null,
  "subscriptionStatus" text,
  "mrrPennies" integer not null default 0,
  "bookings14d" integer not null default 0,
  "bookingsPrev14d" integer not null default 0,
  "clientCount" integer not null default 0,
  "staffCount" integer not null default 0,
  "servicesCount" integer not null default 0,
  "bookingPageLive" boolean,
  "healthScore" smallint,
  "featureFlags" jsonb not null default '{}'::jsonb,
  unique ("techId", "snapshotDate")
);

create index if not exists idx_account_snapshots_date on public.account_snapshots ("snapshotDate");
alter table public.account_snapshots enable row level security;

-- ── cost_records / sms_usage (Phase 2 foundation) ───────────────────────────
create table if not exists public.cost_records (
  id text primary key,
  "periodMonth" text not null,
  provider text not null,
  "amountPennies" integer not null,
  notes text not null default '',
  "enteredBy" text not null,
  "createdAt" timestamptz not null default now(),
  constraint cost_records_provider_chk
    check (provider in ('supabase', 'resend', 'twilio', 'vercel', 'stripe'))
);

alter table public.cost_records enable row level security;

create table if not exists public.sms_usage (
  id text primary key,
  "techId" text not null,
  "messageCount" integer not null default 0,
  "costPennies" integer not null default 0,
  "periodMonth" text not null,
  unique ("techId", "periodMonth")
);

alter table public.sms_usage enable row level security;

-- ── scheduled_sends (Phase 3 foundation; inspectable upcoming outbound) ─────
create table if not exists public.scheduled_sends (
  id text primary key,
  "techId" text not null,
  "bookingId" text,
  "clientId" text,
  kind text not null,
  destination text not null default '',
  "scheduledFor" timestamptz not null,
  status text not null default 'pending',
  "cancelledBy" text,
  "cancelledReason" text,
  "payloadPreview" jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  constraint scheduled_sends_status_chk
    check (status in ('pending', 'sent', 'cancelled', 'skipped'))
);

create index if not exists idx_scheduled_sends_due
  on public.scheduled_sends ("scheduledFor")
  where status = 'pending';
create index if not exists idx_scheduled_sends_tech
  on public.scheduled_sends ("techId", "scheduledFor");
alter table public.scheduled_sends enable row level security;

-- ── impersonation_sessions (Phase 1.2) ──────────────────────────────────────
create table if not exists public.impersonation_sessions (
  id text primary key,
  "ownerEmail" text not null,
  "techId" text not null references public.techs(id) on delete cascade,
  "startedAt" timestamptz not null default now(),
  "endedAt" timestamptz,
  "expiresAt" timestamptz not null,
  "readOnly" boolean not null default true
);

create index if not exists idx_impersonation_active
  on public.impersonation_sessions ("ownerEmail", "expiresAt")
  where "endedAt" is null;
-- At most one open session per owner (partial unique index, not a table constraint).
create unique index if not exists impersonation_sessions_active_owner_unique
  on public.impersonation_sessions ("ownerEmail")
  where "endedAt" is null;
alter table public.impersonation_sessions enable row level security;
