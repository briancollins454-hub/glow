-- Market hardening: compliance records, audit trail, account closure requests,
-- and private calendar feed tokens. Uses the camelCase/text-id schema shape
-- expected by the current application runtime.

alter table public.techs add column if not exists "calendarToken" text;
alter table public.techs add column if not exists "closureRequestedAt" timestamptz;
alter table public.techs add column if not exists "closureReason" text not null default '';

create unique index if not exists idx_techs_calendar_token
  on public.techs("calendarToken")
  where "calendarToken" is not null and "calendarToken" <> '';

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
alter table public.consultation_questions enable row level security;
drop policy if exists consultation_questions_owner on public.consultation_questions;
create policy consultation_questions_owner on public.consultation_questions
  for all using ("techId" = current_tech_id()::text) with check ("techId" = current_tech_id()::text);

create table if not exists public.form_responses (
  id text primary key,
  "techId" text not null,
  "clientId" text not null,
  "bookingId" text,
  answers jsonb not null default '[]'::jsonb,
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_form_responses_client on public.form_responses("clientId", "createdAt");
alter table public.form_responses enable row level security;
drop policy if exists form_responses_owner on public.form_responses;
create policy form_responses_owner on public.form_responses
  for all using ("techId" = current_tech_id()::text) with check ("techId" = current_tech_id()::text);

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
alter table public.client_photos enable row level security;
drop policy if exists client_photos_owner on public.client_photos;
create policy client_photos_owner on public.client_photos
  for all using ("techId" = current_tech_id()::text) with check ("techId" = current_tech_id()::text);

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
alter table public.audit_events enable row level security;
drop policy if exists audit_events_owner on public.audit_events;
create policy audit_events_owner on public.audit_events
  for all using ("techId" = current_tech_id()::text) with check ("techId" = current_tech_id()::text);

create table if not exists public.account_closure_requests (
  id text primary key,
  "techId" text not null,
  reason text not null default '',
  status text not null default 'requested' check (status in ('requested', 'processing', 'completed', 'cancelled')),
  "requestedAt" timestamptz not null default now(),
  "completedAt" timestamptz
);
create index if not exists idx_closure_requests_tech on public.account_closure_requests("techId", "requestedAt");
alter table public.account_closure_requests enable row level security;
drop policy if exists account_closure_requests_owner on public.account_closure_requests;
create policy account_closure_requests_owner on public.account_closure_requests
  for all using ("techId" = current_tech_id()::text) with check ("techId" = current_tech_id()::text);
