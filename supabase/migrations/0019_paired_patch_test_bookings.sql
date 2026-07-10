-- Feature 3: Auto-paired patch test + treatment bookings
-- Non-destructive. Existing services and bookings unchanged.

alter table public.services
  add column if not exists "isPatchTestService" boolean not null default false;

alter table public.bookings
  add column if not exists "pairedBookingId" text;

create index if not exists idx_bookings_paired
  on public.bookings ("pairedBookingId")
  where "pairedBookingId" is not null;

create index if not exists idx_services_patch_test
  on public.services ("techId", "categoryId")
  where "isPatchTestService" = true;
