-- Glow semantic colour tokens.
-- Applied via data-theme on <html>. Dark values match the existing palette exactly.

alter table public.techs
  add column if not exists "dashboardTheme" text not null default 'system',
  add column if not exists "bookingTheme" text not null default 'system';

-- system | dark | light
comment on column public.techs."dashboardTheme" is 'Dashboard UI theme: system, dark, or light';
comment on column public.techs."bookingTheme" is 'Public booking + client token pages theme: system, dark, or light';
