-- Client reviews, SMS/rebooking controls.

-- Reviews: one per booking, moderated by the tech before showing publicly.
create table if not exists public.reviews (
  id text primary key,
  "techId" text not null,
  "clientId" text not null,
  "bookingId" text not null unique,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'hidden')),
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_reviews_tech on public.reviews("techId", status, "createdAt");
alter table public.reviews enable row level security;
drop policy if exists reviews_owner on public.reviews;
create policy reviews_owner on public.reviews
  for all
  using ("techId" in (select id from public.techs where "authUserId"::text = auth.uid()::text))
  with check ("techId" in (select id from public.techs where "authUserId"::text = auth.uid()::text));

-- Automated rebooking nudges: tech-level switch + per-client send tracking.
alter table public.techs add column if not exists "rebookNudgesEnabled" boolean not null default true;
alter table public.clients add column if not exists "lastNudgeAtIso" timestamptz;
