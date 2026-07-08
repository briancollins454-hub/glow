-- Optional manual approval before clients pay a deposit.
-- Production uses text for bookings.status (no booking_status enum).

alter table public.techs
  add column if not exists "requiresBookingApproval" boolean not null default false;

alter table public.bookings
  add column if not exists "approvalToken" text;

create unique index if not exists idx_bookings_approval_token
  on public.bookings ("approvalToken")
  where "approvalToken" is not null;

-- bookings.status is text in production — pending_approval works without enum changes.
