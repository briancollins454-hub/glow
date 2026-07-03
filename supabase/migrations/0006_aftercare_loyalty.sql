-- Aftercare emails, loyalty discounts, and per-booking discount tracking.
alter table public.services add column if not exists "aftercareText" text not null default '';
alter table public.techs add column if not exists "loyaltyVisitThreshold" integer not null default 0;
alter table public.techs add column if not exists "loyaltyDiscountPct" integer not null default 0;
alter table public.bookings add column if not exists "discountPennies" integer not null default 0;
