-- Dedicated branding assets for public booking pages (banner, profile, tagline).

alter table public.techs add column if not exists "coverPhotoPath" text;
alter table public.techs add column if not exists "profilePhotoPath" text;
alter table public.techs add column if not exists tagline text not null default '';
