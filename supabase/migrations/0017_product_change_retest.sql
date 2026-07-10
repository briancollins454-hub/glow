-- Feature 1: Product-change patch test re-flag
-- Non-destructive. Existing patch_tests and reminders rows unchanged.

alter table public.patch_tests
  add column if not exists "invalidatedAtIso" timestamptz,
  add column if not exists "invalidationEventId" text;

create index if not exists idx_patch_tests_invalidation_event
  on public.patch_tests ("invalidationEventId")
  where "invalidationEventId" is not null;

create table if not exists public.product_change_events (
  id text primary key,
  "techId" text not null,
  note text not null default '',
  "scopeSummary" text not null default '',
  "createdAt" timestamptz not null default now()
);

create index if not exists idx_product_change_events_tech
  on public.product_change_events ("techId", "createdAt" desc);

create table if not exists public.product_change_event_categories (
  "eventId" text not null references public.product_change_events (id) on delete cascade,
  "categoryId" text not null,
  primary key ("eventId", "categoryId")
);

create table if not exists public.product_change_event_services (
  "eventId" text not null references public.product_change_events (id) on delete cascade,
  "serviceId" text not null,
  primary key ("eventId", "serviceId")
);

create table if not exists public.product_change_retests (
  id text primary key,
  "techId" text not null,
  "eventId" text not null references public.product_change_events (id) on delete cascade,
  "clientId" text not null,
  "categoryId" text not null,
  status text not null default 'needs_test'
    check (status in ('needs_test', 'test_booked', 'passed')),
  "hasFutureBooking" boolean not null default false,
  "futureBookingId" text,
  "notifiedAtIso" timestamptz,
  "resolvedAtIso" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("eventId", "clientId", "categoryId")
);

create index if not exists idx_product_change_retests_tech_status
  on public.product_change_retests ("techId", status, "createdAt" desc);

create index if not exists idx_product_change_retests_future
  on public.product_change_retests ("techId", "hasFutureBooking", status)
  where "hasFutureBooking" = true;

alter table public.reminders
  alter column "bookingId" drop not null;

alter table public.reminders
  add column if not exists "clientId" text;

create index if not exists idx_reminders_client
  on public.reminders ("clientId", "createdAt" desc)
  where "clientId" is not null;

do $$
begin
  if exists (select 1 from pg_type where typname = 'reminder_kind') then
    execute 'alter type reminder_kind add value if not exists ''patch_test_retest''';
  end if;
exception
  when others then
    raise notice 'reminder_kind enum extend skipped: %', sqlerrm;
end $$;

alter table public.product_change_events enable row level security;
alter table public.product_change_event_categories enable row level security;
alter table public.product_change_event_services enable row level security;
alter table public.product_change_retests enable row level security;

drop policy if exists product_change_events_owner on public.product_change_events;
create policy product_change_events_owner on public.product_change_events
  for all using ("techId" = current_tech_id()::text)
  with check ("techId" = current_tech_id()::text);

drop policy if exists product_change_event_categories_owner on public.product_change_event_categories;
create policy product_change_event_categories_owner on public.product_change_event_categories
  for all using (
    "eventId" in (select id from public.product_change_events where "techId" = current_tech_id()::text)
  ) with check (
    "eventId" in (select id from public.product_change_events where "techId" = current_tech_id()::text)
  );

drop policy if exists product_change_event_services_owner on public.product_change_event_services;
create policy product_change_event_services_owner on public.product_change_event_services
  for all using (
    "eventId" in (select id from public.product_change_events where "techId" = current_tech_id()::text)
  ) with check (
    "eventId" in (select id from public.product_change_events where "techId" = current_tech_id()::text)
  );

drop policy if exists product_change_retests_owner on public.product_change_retests;
create policy product_change_retests_owner on public.product_change_retests
  for all using ("techId" = current_tech_id()::text)
  with check ("techId" = current_tech_id()::text);
