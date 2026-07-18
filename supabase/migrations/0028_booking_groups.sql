-- Basket checkout: multiple treatments booked back-to-back as one visit.
-- Bookings created together share a groupId; money is charged once for the
-- group (one deposit checkout, one balance payment) with the ledger row
-- attached to the primary (earliest) booking.

alter table public.bookings
  add column if not exists "groupId" text;

create index if not exists idx_bookings_group
  on public.bookings ("groupId")
  where "groupId" is not null;
