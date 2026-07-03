-- Referral attribution + onboarding email drip.
alter table public.techs add column if not exists "referredBy" text;

create table if not exists public.onboarding_emails (
  id text primary key,
  "techId" text not null references public.techs(id) on delete cascade,
  kind text not null,
  "sendAtIso" timestamptz not null,
  status text not null default 'scheduled',
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_onboarding_due on public.onboarding_emails(status, "sendAtIso");
-- Service-role access only (no anon policies).
alter table public.onboarding_emails enable row level security;
