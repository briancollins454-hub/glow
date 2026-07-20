-- Public booking page on/off (separate from subscription).
-- Subscribed salons can pause online bookings until they're ready to share the link.
-- Default true so existing live accounts keep accepting bookings.

alter table public.techs
  add column if not exists "bookingPageLive" boolean not null default true;

-- Allure Beauty: pause online booking until they choose to go live.
update public.techs
set "bookingPageLive" = false
where handle = 'allurebeauty';
