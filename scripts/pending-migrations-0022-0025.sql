-- Feature 7: Infill deadline nudge
-- Reminds clients to book an infill before their window closes.

alter table public.techs
  add column if not exists "infillNudgesEnabled" boolean not null default true;

create table if not exists public.infill_deadline_nudges (
  id text primary key,
  "techId" text not null,
  "clientId" text not null,
  "baseBookingId" text not null references public.bookings (id) on delete cascade,
  "infillServiceId" text not null,
  "deadlineIso" timestamptz not null,
  "sendAtIso" timestamptz not null,
  "sentAtIso" timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sent', 'skipped')),
  "createdAt" timestamptz not null default now()
);

create unique index if not exists idx_infill_deadline_nudges_base_booking
  on public.infill_deadline_nudges ("baseBookingId");

create index if not exists idx_infill_deadline_nudges_send
  on public.infill_deadline_nudges (status, "sendAtIso")
  where status = 'scheduled';

create index if not exists idx_infill_deadline_nudges_tech
  on public.infill_deadline_nudges ("techId", "createdAt" desc);

alter table public.infill_deadline_nudges enable row level security;

drop policy if exists infill_deadline_nudges_owner on public.infill_deadline_nudges;
create policy infill_deadline_nudges_owner on public.infill_deadline_nudges
  for all using ("techId" = current_tech_id()::text)
  with check ("techId" = current_tech_id()::text);
-- Feature 8: One-tap running late cascade
-- Logs when a tech notifies today's clients they are running late.

create table if not exists public.late_cascade_events (
  id text primary key,
  "techId" text not null,
  "minutesLate" int not null check ("minutesLate" > 0 and "minutesLate" <= 240),
  note text not null default '',
  "targetDate" text not null,
  "bookingsNotified" int not null default 0,
  "createdAt" timestamptz not null default now()
);

create index if not exists idx_late_cascade_events_tech
  on public.late_cascade_events ("techId", "createdAt" desc);

create table if not exists public.late_cascade_notifications (
  id text primary key,
  "eventId" text not null references public.late_cascade_events (id) on delete cascade,
  "techId" text not null,
  "bookingId" text not null references public.bookings (id) on delete cascade,
  "clientId" text not null,
  channel text not null check (channel in ('email', 'sms')),
  "createdAt" timestamptz not null default now()
);

create index if not exists idx_late_cascade_notifications_booking
  on public.late_cascade_notifications ("bookingId", "createdAt" desc);

alter table public.late_cascade_events enable row level security;
alter table public.late_cascade_notifications enable row level security;

drop policy if exists late_cascade_events_owner on public.late_cascade_events;
create policy late_cascade_events_owner on public.late_cascade_events
  for all using ("techId" = current_tech_id()::text)
  with check ("techId" = current_tech_id()::text);

drop policy if exists late_cascade_notifications_owner on public.late_cascade_notifications;
create policy late_cascade_notifications_owner on public.late_cascade_notifications
  for all using ("techId" = current_tech_id()::text)
  with check ("techId" = current_tech_id()::text);
-- Feature 9: Pre-care confirmations
-- Sends prep instructions before appointments and records client confirmation.

alter table public.services
  add column if not exists "precareText" text not null default '';

alter table public.techs
  add column if not exists "preCareConfirmationsEnabled" boolean not null default true;

create table if not exists public.pre_care_confirmations (
  id text primary key,
  "techId" text not null,
  "clientId" text not null,
  "bookingId" text not null references public.bookings (id) on delete cascade,
  token text not null unique,
  "sendAtIso" timestamptz not null,
  "sentAtIso" timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sent', 'confirmed', 'skipped')),
  "confirmedAtIso" timestamptz,
  "createdAt" timestamptz not null default now()
);

create unique index if not exists idx_pre_care_confirmations_booking
  on public.pre_care_confirmations ("bookingId");

create index if not exists idx_pre_care_confirmations_send
  on public.pre_care_confirmations (status, "sendAtIso")
  where status = 'scheduled';

create index if not exists idx_pre_care_confirmations_tech
  on public.pre_care_confirmations ("techId", "createdAt" desc);

alter table public.pre_care_confirmations enable row level security;

drop policy if exists pre_care_confirmations_owner on public.pre_care_confirmations;
create policy pre_care_confirmations_owner on public.pre_care_confirmations
  for all using ("techId" = current_tech_id()::text)
  with check ("techId" = current_tech_id()::text);

-- Public token lookup for client confirmation page.
create or replace function public.pre_care_confirmation_by_token(lookup_token text)
returns setof public.pre_care_confirmations
language sql
security definer
set search_path = public
stable
as $$
  select * from public.pre_care_confirmations where token = lookup_token limit 1;
$$;

grant execute on function public.pre_care_confirmation_by_token(text) to anon, authenticated, service_role;
-- Feature 12: DM quote links
-- Shareable quote pages for Instagram / WhatsApp DMs with a book-now link.

create table if not exists public.dm_quote_links (
  id text primary key,
  "techId" text not null,
  "clientId" text references public.clients (id) on delete set null,
  "serviceId" text not null,
  token text not null unique,
  "clientName" text not null default '',
  addons jsonb not null default '[]',
  note text not null default '',
  "pricePennies" int not null,
  "depositPennies" int not null,
  "viewedAtIso" timestamptz,
  "createdAt" timestamptz not null default now()
);

create index if not exists idx_dm_quote_links_tech
  on public.dm_quote_links ("techId", "createdAt" desc);

create index if not exists idx_dm_quote_links_client
  on public.dm_quote_links ("techId", "clientId", "createdAt" desc)
  where "clientId" is not null;

alter table public.dm_quote_links enable row level security;

drop policy if exists dm_quote_links_owner on public.dm_quote_links;
create policy dm_quote_links_owner on public.dm_quote_links
  for all using ("techId" = current_tech_id()::text)
  with check ("techId" = current_tech_id()::text);

create or replace function public.dm_quote_by_token(lookup_token text)
returns setof public.dm_quote_links
language sql
security definer
set search_path = public
stable
as $$
  select * from public.dm_quote_links where token = lookup_token limit 1;
$$;

grant execute on function public.dm_quote_by_token(text) to anon, authenticated, service_role;
