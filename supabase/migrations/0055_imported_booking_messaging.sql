-- Imported booking messaging controls + never-subscribed client-messaging gate.
-- Imported appointments must not email/SMS clients until the tech opts in.
-- Balance requests for imported bookings stay off unless enabled per booking.

alter table public.bookings
  add column if not exists "importedAt" timestamptz,
  add column if not exists "importedBalanceRequestEnabled" boolean not null default false;

comment on column public.bookings."importedAt" is
  'Set when the booking was created via Move to Glow / CSV import. Null = native Glow booking.';
comment on column public.bookings."importedBalanceRequestEnabled" is
  'Imported bookings never get balance-request emails unless the tech enables this per booking.';

alter table public.techs
  add column if not exists "importedBookingRemindersOptIn" boolean not null default false,
  add column if not exists "importedBookingRemindersOptInAt" timestamptz,
  add column if not exists "clientMessagingConfirmedAt" timestamptz;

comment on column public.techs."importedBookingRemindersOptIn" is
  'When true, upcoming imported bookings may receive reminder emails/SMS (never balance requests).';
comment on column public.techs."clientMessagingConfirmedAt" is
  'Set when a never-subscribed tech confirms Glow may contact their clients. Live plans always allowed.';

-- Backfill known imports (notes stamped by csv-import).
update public.bookings
set "importedAt" = coalesce("importedAt", "createdAt")
where "importedAt" is null
  and notes = 'Imported';
