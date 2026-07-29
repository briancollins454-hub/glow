-- Owner account moderation: block (soft) and support hard-delete metadata.
-- Exclusive to brian@thesupportsdesk.com in application code.

alter table public.techs
  add column if not exists "blockedAt" timestamptz,
  add column if not exists "blockedReason" text not null default '',
  add column if not exists "blockedByEmail" text;

comment on column public.techs."blockedAt" is
  'When set, account is blocked: no dashboard login, no public bookings. Owner-only.';
comment on column public.techs."blockedReason" is
  'Why the account was blocked (T&Cs breach, abuse, etc).';
comment on column public.techs."blockedByEmail" is
  'Email of the platform owner who blocked the account.';
