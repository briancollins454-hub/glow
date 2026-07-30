-- Salon locale: currency, country, timezone (international rollout, prompt 1).
-- Nullable, no defaults — existing rows stay null and the app falls back to GB.

alter table public.techs
  add column if not exists currency text,
  add column if not exists country text,
  add column if not exists timezone text;

comment on column public.techs.currency is
  'Salon locale ISO 4217 currency for service prices and client payments — not the platform subscription currency (always GBP).';
comment on column public.techs.country is
  'Salon locale ISO 3166-1 alpha-2 country — drives Connect country and region features; not the platform country.';
comment on column public.techs.timezone is
  'Salon locale IANA timezone for calendar, rota and reminders — not the platform reporting timezone.';
