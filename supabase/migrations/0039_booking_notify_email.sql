-- Email the salon (and assigned staff) when a new online booking is confirmed
-- or approved. Default on so existing accounts keep getting notified.
alter table public.techs
  add column if not exists "bookingNotifyEmailEnabled" boolean not null default true;
