-- Cancellation list: clients ask to be told when a slot opens up.
create table if not exists public.waitlist_entries (
  id text primary key,
  "techId" text not null,
  "serviceId" text,
  name text not null,
  email text not null,
  phone text not null default '',
  -- Preferred date (yyyy-mm-dd in Europe/London), '' = any date.
  "dateStr" text not null default '',
  "notifiedAtIso" timestamptz,
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_waitlist_tech on public.waitlist_entries("techId", "createdAt");
alter table public.waitlist_entries enable row level security;
drop policy if exists waitlist_entries_owner on public.waitlist_entries;
create policy waitlist_entries_owner on public.waitlist_entries
  for all
  using ("techId" in (select id from public.techs where "authUserId"::text = auth.uid()::text))
  with check ("techId" in (select id from public.techs where "authUserId"::text = auth.uid()::text));
