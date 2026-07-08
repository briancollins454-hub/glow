-- Optional manual approval before clients pay a deposit.

alter table public.techs
  add column if not exists "requiresBookingApproval" boolean not null default false;

alter table public.bookings
  add column if not exists "approvalToken" text;

create unique index if not exists idx_bookings_approval_token
  on public.bookings ("approvalToken")
  where "approvalToken" is not null;

-- Extend booking_status enum (safe if already applied).
do $$
begin
  alter type booking_status add value if not exists 'pending_approval';
exception
  when duplicate_object then null;
end $$;
