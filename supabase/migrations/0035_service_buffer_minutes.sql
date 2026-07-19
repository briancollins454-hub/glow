-- Cleanup / buffer time after a service (minutes).
-- Blocks the diary after the appointment so the next client can't book
-- during cleanup, without changing the client's appointment end time.

alter table public.services
  add column if not exists "bufferMinutes" integer not null default 0;
