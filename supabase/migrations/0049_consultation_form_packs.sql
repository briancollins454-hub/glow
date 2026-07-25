-- Consultation form packs: one question set, attach to many categories/services.

create table if not exists public.consultation_packs (
  id text primary key,
  "techId" text not null,
  name text not null,
  "sortOrder" integer not null default 0,
  active boolean not null default true,
  "createdAt" timestamptz not null default now()
);

create index if not exists idx_consultation_packs_tech
  on public.consultation_packs("techId", "sortOrder", "createdAt");

alter table public.consultation_packs enable row level security;
drop policy if exists consultation_packs_owner on public.consultation_packs;
create policy consultation_packs_owner on public.consultation_packs
  for all using ("techId" = current_tech_id()::text)
  with check ("techId" = current_tech_id()::text);

-- Zero rows for a pack = shown for all services.
-- Otherwise any matching category or service target includes the pack.
create table if not exists public.consultation_pack_targets (
  id text primary key,
  "packId" text not null references public.consultation_packs (id) on delete cascade,
  "categoryId" text,
  "serviceId" text,
  constraint consultation_pack_targets_one_scope check (
    ("categoryId" is not null and "serviceId" is null)
    or ("categoryId" is null and "serviceId" is not null)
  )
);

create index if not exists idx_pack_targets_pack
  on public.consultation_pack_targets("packId");

create index if not exists idx_pack_targets_category
  on public.consultation_pack_targets("categoryId")
  where "categoryId" is not null;

create index if not exists idx_pack_targets_service
  on public.consultation_pack_targets("serviceId")
  where "serviceId" is not null;

alter table public.consultation_pack_targets enable row level security;
drop policy if exists consultation_pack_targets_owner on public.consultation_pack_targets;
create policy consultation_pack_targets_owner on public.consultation_pack_targets
  for all using (
    exists (
      select 1 from public.consultation_packs p
      where p.id = "packId" and p."techId" = current_tech_id()::text
    )
  )
  with check (
    exists (
      select 1 from public.consultation_packs p
      where p.id = "packId" and p."techId" = current_tech_id()::text
    )
  );

alter table public.consultation_questions
  add column if not exists "packId" text references public.consultation_packs (id) on delete cascade;

create index if not exists idx_questions_pack
  on public.consultation_questions("packId")
  where "packId" is not null;
