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
