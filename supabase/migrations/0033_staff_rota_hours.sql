-- Week-by-week staff rota.
--
-- Recurring working_hours (and flexible daily windows) are still the default.
-- When a rota week is saved for a staff member, online booking uses those
-- exact days/times for that calendar week instead.

create table if not exists public.rota_hours (
  id text primary key,
  "techId" text not null,
  "staffId" text not null references public.staff_members (id) on delete cascade,
  -- Monday of the week (Europe/London calendar date).
  "weekStart" date not null,
  weekday int not null check (weekday between 0 and 6),
  "startMinutes" int not null,
  "endMinutes" int not null,
  "lastStartMinutes" int,
  enabled boolean not null default true
);

create unique index if not exists idx_rota_hours_staff_week_day
  on public.rota_hours ("staffId", "weekStart", weekday);

create index if not exists idx_rota_hours_tech_week
  on public.rota_hours ("techId", "weekStart");

alter table public.rota_hours enable row level security;

drop policy if exists rota_hours_owner on public.rota_hours;
create policy rota_hours_owner on public.rota_hours
  for all using ("techId" = current_tech_id()::text)
  with check ("techId" = current_tech_id()::text);
