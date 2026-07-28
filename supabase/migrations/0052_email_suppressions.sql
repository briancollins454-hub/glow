-- Email deliverability: Resend webhook outcomes + suppression list.
-- Hard bounces and spam complaints suppress permanently. Soft (transient)
-- bounces suppress after 3 consecutive failures. Complaints also set
-- clients.marketingOptOut so marketing mail stops for that address.

-- Link outbound_sends rows to Resend email ids so webhooks can update them.
alter table public.outbound_sends
  add column if not exists "resendEmailId" text,
  add column if not exists "deliveryStatus" text,
  add column if not exists "bounceType" text,
  add column if not exists "deliveryUpdatedAt" timestamptz;

create index if not exists idx_outbound_sends_resend_email
  on public.outbound_sends ("resendEmailId")
  where "resendEmailId" is not null;

-- Platform-wide suppression keyed by normalised email (lowercase).
create table if not exists public.email_suppressions (
  email text primary key,
  suppressed boolean not null default false,
  permanent boolean not null default false,
  reason text,
  "consecutiveSoftFailures" integer not null default 0,
  "lastEventType" text,
  "lastResendEmailId" text,
  "lastOutboundId" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists idx_email_suppressions_suppressed
  on public.email_suppressions (suppressed)
  where suppressed = true;

alter table public.email_suppressions enable row level security;

-- Denormalised flags on clients for dashboard badges (synced from suppressions).
alter table public.clients
  add column if not exists "emailSuppressed" boolean not null default false,
  add column if not exists "emailSuppressionReason" text,
  add column if not exists "emailSoftBounceCount" integer not null default 0,
  add column if not exists "emailLastDeliveryEventAt" timestamptz;

comment on column public.clients."emailSuppressed" is
  'True when this address is on the platform suppression list (hard bounce, soft×3, or complaint).';
comment on column public.clients."emailSuppressionReason" is
  'hard_bounce | soft_bounce | complaint | null';
