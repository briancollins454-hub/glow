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
