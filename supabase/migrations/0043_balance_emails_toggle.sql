-- Salons that take the balance in person can switch off the "pay your
-- balance" emails/SMS (the 48h balance_request reminder and the "Pay balance
-- early" button on booking confirmations). Default stays ON so nothing
-- changes for existing accounts until they untick it in Settings.

alter table public.techs
  add column if not exists "balanceEmailsEnabled" boolean not null default true;
