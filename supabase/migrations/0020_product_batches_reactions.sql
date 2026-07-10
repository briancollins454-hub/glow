-- Feature 4: Product batch logging + reaction tracing
-- Non-destructive. Links batches to patch tests, bookings and adverse reactions.

create table if not exists public.products (
  id text primary key,
  "techId" text not null,
  "categoryId" text not null,
  name text not null,
  brand text not null default '',
  "productType" text not null default 'other'
    check ("productType" in ('adhesive', 'tint', 'lift', 'other')),
  active boolean not null default true,
  "createdAt" timestamptz not null default now()
);

create index if not exists idx_products_tech_category
  on public.products ("techId", "categoryId", active);

create table if not exists public.product_batches (
  id text primary key,
  "techId" text not null,
  "productId" text not null references public.products (id) on delete cascade,
  "lotNumber" text not null default '',
  "openedAtIso" timestamptz,
  "expiresAtIso" timestamptz,
  "changeEventId" text references public.product_change_events (id) on delete set null,
  notes text not null default '',
  "retiredAtIso" timestamptz,
  "createdAt" timestamptz not null default now()
);

create index if not exists idx_product_batches_tech_product
  on public.product_batches ("techId", "productId", "createdAt" desc);

create index if not exists idx_product_batches_change_event
  on public.product_batches ("changeEventId")
  where "changeEventId" is not null;

create table if not exists public.product_usages (
  id text primary key,
  "techId" text not null,
  "batchId" text not null references public.product_batches (id) on delete cascade,
  "clientId" text not null,
  "patchTestId" text references public.patch_tests (id) on delete set null,
  "bookingId" text references public.bookings (id) on delete set null,
  "usedAtIso" timestamptz not null default now(),
  "createdAt" timestamptz not null default now(),
  check ("patchTestId" is not null or "bookingId" is not null)
);

create index if not exists idx_product_usages_client
  on public.product_usages ("techId", "clientId", "usedAtIso" desc);

create index if not exists idx_product_usages_batch
  on public.product_usages ("batchId", "usedAtIso" desc);

create index if not exists idx_product_usages_patch_test
  on public.product_usages ("patchTestId")
  where "patchTestId" is not null;

create index if not exists idx_product_usages_booking
  on public.product_usages ("bookingId")
  where "bookingId" is not null;

create table if not exists public.client_reactions (
  id text primary key,
  "techId" text not null,
  "clientId" text not null,
  "categoryId" text not null,
  severity text not null default 'mild'
    check (severity in ('mild', 'moderate', 'severe')),
  symptoms text not null default '',
  "onsetIso" timestamptz not null default now(),
  "batchId" text references public.product_batches (id) on delete set null,
  "patchTestId" text references public.patch_tests (id) on delete set null,
  "bookingId" text references public.bookings (id) on delete set null,
  notes text not null default '',
  "createdAt" timestamptz not null default now()
);

create index if not exists idx_client_reactions_client
  on public.client_reactions ("techId", "clientId", "onsetIso" desc);

create index if not exists idx_client_reactions_batch
  on public.client_reactions ("batchId")
  where "batchId" is not null;

alter table public.product_change_events
  add column if not exists "newBatchId" text;

alter table public.products enable row level security;
alter table public.product_batches enable row level security;
alter table public.product_usages enable row level security;
alter table public.client_reactions enable row level security;

drop policy if exists products_owner on public.products;
create policy products_owner on public.products
  for all using ("techId" = current_tech_id()::text)
  with check ("techId" = current_tech_id()::text);

drop policy if exists product_batches_owner on public.product_batches;
create policy product_batches_owner on public.product_batches
  for all using ("techId" = current_tech_id()::text)
  with check ("techId" = current_tech_id()::text);

drop policy if exists product_usages_owner on public.product_usages;
create policy product_usages_owner on public.product_usages
  for all using ("techId" = current_tech_id()::text)
  with check ("techId" = current_tech_id()::text);

drop policy if exists client_reactions_owner on public.client_reactions;
create policy client_reactions_owner on public.client_reactions
  for all using ("techId" = current_tech_id()::text)
  with check ("techId" = current_tech_id()::text);
