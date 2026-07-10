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
