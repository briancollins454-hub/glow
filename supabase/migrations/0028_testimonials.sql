-- Imported testimonials: clearly-labelled, unverified quotes from a previous
-- platform. Kept strictly separate from Glow reviews (no effect on star average).

create table if not exists public.testimonials (
  id text primary key,
  "techId" text not null,
  "authorLabel" text not null,
  rating integer check (rating is null or (rating between 1 and 5)),
  body text not null,
  "sourceLabel" text not null default 'previous platform',
  "showUntil" timestamptz,
  "createdAt" timestamptz not null default now()
);

create index if not exists idx_testimonials_tech
  on public.testimonials ("techId", "createdAt" desc);

create index if not exists idx_testimonials_tech_visible
  on public.testimonials ("techId", "showUntil");

alter table public.testimonials enable row level security;

drop policy if exists testimonials_owner on public.testimonials;
create policy testimonials_owner on public.testimonials
  for all using ("techId" = current_tech_id()::text)
  with check ("techId" = current_tech_id()::text);

-- Public booking pages load via the service role (same as approved reviews).
-- No anon SELECT policy: one tech cannot read another tech's testimonials.
