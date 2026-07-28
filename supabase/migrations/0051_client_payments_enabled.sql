-- Salon-level master switch for client-initiated payments (deposits, balance
-- pay links, card-on-file, no-show fee charges). Default ON so existing salons
-- keep current behaviour. Turning it off does not clear per-service deposit
-- config — deposits stay on services and resume when the switch is flipped back.

alter table public.techs
  add column if not exists "clientPaymentsEnabled" boolean not null default true;

comment on column public.techs."clientPaymentsEnabled" is
  'When false, clients are never asked to pay online (self-employed teams). Dashboard cash / settle-up still works.';
