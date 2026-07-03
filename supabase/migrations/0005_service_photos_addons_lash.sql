-- Service photos, bookable extras (add-ons), and lash record fields.
alter table public.services add column if not exists "photoPath" text;

create table if not exists public.service_addons (
  id text primary key,
  "techId" text not null references public.techs(id) on delete cascade,
  "serviceId" text not null references public.services(id) on delete cascade,
  name text not null,
  "pricePennies" integer not null default 0,
  active boolean not null default true,
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_addons_service on public.service_addons("serviceId");
alter table public.service_addons enable row level security;
drop policy if exists service_addons_owner on public.service_addons;
create policy service_addons_owner on public.service_addons
  for all using ("techId" = current_tech_id()) with check ("techId" = current_tech_id());

-- Lash record per appointment (map, curl, length) + extras chosen at booking.
alter table public.bookings add column if not exists "lashMap" text not null default '';
alter table public.bookings add column if not exists "lashCurl" text not null default '';
alter table public.bookings add column if not exists "lashLength" text not null default '';
alter table public.bookings add column if not exists addons jsonb not null default '[]'::jsonb;
