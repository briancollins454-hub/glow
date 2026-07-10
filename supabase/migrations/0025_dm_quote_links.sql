-- Feature 12: DM quote links
-- Shareable quote pages for Instagram / WhatsApp DMs with a book-now link.

create table if not exists public.dm_quote_links (
  id text primary key,
  "techId" text not null,
  "clientId" text references public.clients (id) on delete set null,
  "serviceId" text not null,
  token text not null unique,
  "clientName" text not null default '',
  addons jsonb not null default '[]',
  note text not null default '',
  "pricePennies" int not null,
  "depositPennies" int not null,
  "viewedAtIso" timestamptz,
  "createdAt" timestamptz not null default now()
);

create index if not exists idx_dm_quote_links_tech
  on public.dm_quote_links ("techId", "createdAt" desc);

create index if not exists idx_dm_quote_links_client
  on public.dm_quote_links ("techId", "clientId", "createdAt" desc)
  where "clientId" is not null;

alter table public.dm_quote_links enable row level security;

drop policy if exists dm_quote_links_owner on public.dm_quote_links;
create policy dm_quote_links_owner on public.dm_quote_links
  for all using ("techId" = current_tech_id()::text)
  with check ("techId" = current_tech_id()::text);

create or replace function public.dm_quote_by_token(lookup_token text)
returns setof public.dm_quote_links
language sql
security definer
set search_path = public
stable
as $$
  select * from public.dm_quote_links where token = lookup_token limit 1;
$$;

grant execute on function public.dm_quote_by_token(text) to anon, authenticated, service_role;
