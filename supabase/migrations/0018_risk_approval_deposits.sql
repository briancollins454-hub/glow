-- Feature 2: Rules-based approval + risk-tiered deposits
-- Non-destructive. Existing bookings and tech settings unchanged.

alter table public.techs
  add column if not exists "approvalMode" text not null default 'off'
    check ("approvalMode" in ('off', 'manual', 'rules')),
  add column if not exists "depositTierMediumPct" int not null default 50,
  add column if not exists "depositTierHighPct" int not null default 100,
  add column if not exists "autoApproveMinVisits" int not null default 2;

-- Techs who already use manual approval keep the same behaviour.
update public.techs
set "approvalMode" = 'manual'
where "requiresBookingApproval" = true
  and "approvalMode" = 'off';

alter table public.bookings
  add column if not exists "riskTier" text
    check ("riskTier" is null or "riskTier" in ('low', 'medium', 'high')),
  add column if not exists "autoApproved" boolean not null default false;

create index if not exists idx_bookings_risk_tier
  on public.bookings ("techId", "riskTier", "createdAt" desc)
  where "riskTier" is not null;
