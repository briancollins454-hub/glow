-- Flexible opening hours.
--
-- Techs whose roster changes week to week can turn off the fixed Mon-Sun
-- pattern and offer bookable slots every day inside one daily window. Time off
-- and existing bookings still block times. Pair with booking approval so they
-- can accept or decline requests that fall on days they are not working.

alter table public.techs
  add column if not exists "flexibleHoursEnabled" boolean not null default false;

-- Daily window used when flexible hours are on (minutes from midnight, London).
alter table public.techs
  add column if not exists "flexibleStartMinutes" integer not null default 540;

alter table public.techs
  add column if not exists "flexibleEndMinutes" integer not null default 1200;

-- Optional latest start time (appointment may run past closing). null = auto.
alter table public.techs
  add column if not exists "flexibleLastStartMinutes" integer;
