-- Salon-level master switch for client-initiated payments (deposits and
-- balance pay links / emails). Default ON so existing salons keep current
-- behaviour. Does NOT govern card-on-file capture or no-show fee charges —
-- those follow the salon's card-protection settings. Turning it off does not
-- clear per-service deposit config — deposits stay on services and resume
-- when the switch is flipped back.

alter table public.techs
  add column if not exists "clientPaymentsEnabled" boolean not null default true;

comment on column public.techs."clientPaymentsEnabled" is
  'When false, clients are never asked to pay deposits/balances online. Card capture and no-show fees are independent. Dashboard cash / settle-up still works.';
