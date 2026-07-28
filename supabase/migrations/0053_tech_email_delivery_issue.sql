-- Protect tech/staff addresses from silent email suppression.
-- Bounce/complaint on an account address flags the account and alerts ops
-- instead of adding the address to email_suppressions. Client addresses
-- continue to suppress as before (migration 0052).

alter table public.techs
  add column if not exists "emailDeliveryIssue" boolean not null default false,
  add column if not exists "emailDeliveryIssueReason" text,
  add column if not exists "emailDeliveryIssueAt" timestamptz;

comment on column public.techs."emailDeliveryIssue" is
  'True when Glow could not deliver email to this salon owner address (bounce/complaint). Never auto-suppresses; ops is alerted.';
comment on column public.techs."emailDeliveryIssueReason" is
  'hard_bounce | soft_bounce | complaint | restored_from_suppression | null';

alter table public.staff_members
  add column if not exists "emailDeliveryIssue" boolean not null default false,
  add column if not exists "emailDeliveryIssueReason" text,
  add column if not exists "emailDeliveryIssueAt" timestamptz;

comment on column public.staff_members."emailDeliveryIssue" is
  'True when Glow could not deliver email to this staff login address. Never auto-suppresses; ops is alerted.';
