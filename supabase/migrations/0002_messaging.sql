-- Glow messaging: per-client conversation threads between a tech and a client.
-- NOTE: the live database uses camelCase, quoted identifiers and text ids
-- (app-generated), matching lib/db/queries.ts — not the snake_case in 0001.

create table if not exists public.messages (
  id text primary key,
  "techId" text not null references public.techs(id) on delete cascade,
  "clientId" text not null references public.clients(id) on delete cascade,
  sender text not null check (sender in ('tech','client')),
  body text not null,
  "readAt" timestamptz,
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_messages_tech on public.messages("techId");
create index if not exists idx_messages_client on public.messages("clientId", "createdAt");

alter table public.messages enable row level security;
drop policy if exists messages_owner on public.messages;
create policy messages_owner on public.messages
  for all using ("techId" = current_tech_id()) with check ("techId" = current_tech_id());

-- Private, unguessable per-client token powering the no-login client thread page (/m/{token}).
alter table public.clients add column if not exists "messageToken" text;
update public.clients set "messageToken" = replace(gen_random_uuid()::text, '-', '') where "messageToken" is null;
alter table public.clients alter column "messageToken" set default replace(gen_random_uuid()::text, '-', '');
create unique index if not exists idx_clients_message_token on public.clients("messageToken");
