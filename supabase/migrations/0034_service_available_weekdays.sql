-- Per-service available weekdays.
--
-- null or empty = bookable any day the salon/staff is open.
-- Otherwise only those weekdays (0 = Sunday … 6 = Saturday, Europe/London).

alter table public.services
  add column if not exists "availableWeekdays" integer[];
