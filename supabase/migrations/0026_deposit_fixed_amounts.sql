-- Settings: allow £ fixed amounts (not just %) for deposits, no-show fee, risk tiers, and loyalty.

alter table public.techs
  add column if not exists "defaultDepositType" text not null default 'percent'
    check ("defaultDepositType" in ('percent', 'fixed', 'none')),
  add column if not exists "defaultDepositValue" int,
  add column if not exists "noShowFeeType" text not null default 'percent'
    check ("noShowFeeType" in ('percent', 'fixed')),
  add column if not exists "noShowFeeValue" int,
  add column if not exists "depositTierMediumType" text not null default 'percent'
    check ("depositTierMediumType" in ('percent', 'fixed')),
  add column if not exists "depositTierMediumValue" int,
  add column if not exists "depositTierHighType" text not null default 'percent'
    check ("depositTierHighType" in ('percent', 'fixed')),
  add column if not exists "depositTierHighValue" int,
  add column if not exists "loyaltyDiscountType" text not null default 'percent'
    check ("loyaltyDiscountType" in ('percent', 'fixed')),
  add column if not exists "loyaltyDiscountValue" int;

-- Backfill values from existing percentage columns (percent mode).
update public.techs
set "defaultDepositValue" = "defaultDepositPct"
where "defaultDepositValue" is null;

update public.techs
set "noShowFeeValue" = "noShowFeePct"
where "noShowFeeValue" is null;

update public.techs
set "depositTierMediumValue" = coalesce("depositTierMediumPct", 50)
where "depositTierMediumValue" is null;

update public.techs
set "depositTierHighValue" = coalesce("depositTierHighPct", 100)
where "depositTierHighValue" is null;

update public.techs
set "loyaltyDiscountValue" = "loyaltyDiscountPct"
where "loyaltyDiscountValue" is null;
