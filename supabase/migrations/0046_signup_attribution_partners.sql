-- Signup attribution + partner academy offers.

alter table public.techs
  add column if not exists "signupUtmSource" text,
  add column if not exists "signupUtmMedium" text,
  add column if not exists "signupUtmCampaign" text,
  add column if not exists "signupHeardAbout" text,
  add column if not exists "signupPartnerSlug" text,
  add column if not exists "referralCreditGrantedAt" timestamptz;

create table if not exists public.partners (
  id text primary key,
  slug text not null unique,
  name text not null,
  "logoUrl" text not null default '',
  "offerType" text not null default 'three_months_free',
  active boolean not null default true,
  "createdAt" timestamptz not null default now()
);

create index if not exists idx_partners_slug on public.partners (slug);
create index if not exists idx_techs_partner_slug on public.techs ("signupPartnerSlug");
