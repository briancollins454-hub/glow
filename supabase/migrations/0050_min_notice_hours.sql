-- Minimum notice for public online bookings (hours). Clients cannot book a
-- slot sooner than now + minNoticeHours. Dashboard / tech-created bookings
-- are unaffected. Business default on techs; optional per-staff override
-- (null = inherit the business default). Existing accounts stay at 0 so
-- behaviour does not change until they raise it in Settings.

alter table public.techs
  add column if not exists "minNoticeHours" integer not null default 0;

alter table public.staff_members
  add column if not exists "minNoticeHours" integer null;

comment on column public.techs."minNoticeHours" is
  'Hours of notice clients need for online booking (0–168). Dashboard booking ignores this.';

comment on column public.staff_members."minNoticeHours" is
  'Optional override of techs.minNoticeHours for this staff member; null = use business default.';
