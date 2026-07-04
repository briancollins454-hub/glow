-- Direct Google Calendar sync. iCal remains as a fallback, but this supports
-- the one-click "Connect Google Calendar" flow for non-technical users.

alter table public.techs add column if not exists "googleRefreshToken" text;
alter table public.techs add column if not exists "googleCalendarId" text;
alter table public.techs add column if not exists "googleCalendarEmail" text;
alter table public.techs add column if not exists "googleConnectedAt" timestamptz;

alter table public.bookings add column if not exists "googleEventId" text;
create index if not exists idx_bookings_google_event on public.bookings("googleEventId");
