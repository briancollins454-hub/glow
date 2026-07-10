-- Feature 5: 48-hour reaction check-in
-- Schedules a follow-up email/SMS after patch tests and chemical treatments.

create table if not exists public.reaction_checkins (
  id text primary key,
  "techId" text not null,
  "clientId" text not null,
  "categoryId" text not null,
  "patchTestId" text references public.patch_tests (id) on delete set null,
  "bookingId" text references public.bookings (id) on delete set null,
  token text not null unique,
  "sendAtIso" timestamptz not null,
  "sentAtIso" timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sent', 'responded', 'skipped')),
  response text
    check (response is null or response in ('fine', 'reaction')),
  symptoms text not null default '',
  "reactionId" text references public.client_reactions (id) on delete set null,
  "createdAt" timestamptz not null default now()
);

create index if not exists idx_reaction_checkins_send
  on public.reaction_checkins (status, "sendAtIso")
  where status = 'scheduled';

create index if not exists idx_reaction_checkins_tech
  on public.reaction_checkins ("techId", "createdAt" desc);

create index if not exists idx_reaction_checkins_client
  on public.reaction_checkins ("techId", "clientId", "createdAt" desc);

create unique index if not exists idx_reaction_checkins_patch_test
  on public.reaction_checkins ("patchTestId")
  where "patchTestId" is not null;

create unique index if not exists idx_reaction_checkins_booking
  on public.reaction_checkins ("bookingId")
  where "bookingId" is not null;

alter table public.reaction_checkins enable row level security;

drop policy if exists reaction_checkins_owner on public.reaction_checkins;
create policy reaction_checkins_owner on public.reaction_checkins
  for all using ("techId" = current_tech_id()::text)
  with check ("techId" = current_tech_id()::text);

-- Public token lookup for client check-in page (read + update response only).
create or replace function public.reaction_checkin_by_token(lookup_token text)
returns setof public.reaction_checkins
language sql
security definer
set search_path = public
stable
as $$
  select * from public.reaction_checkins where token = lookup_token limit 1;
$$;

grant execute on function public.reaction_checkin_by_token(text) to anon, authenticated, service_role;
