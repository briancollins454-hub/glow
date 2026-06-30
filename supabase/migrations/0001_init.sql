-- Glow booking platform - initial schema
-- Production source of truth. The MVP runtime currently uses a local JSON store
-- (lib/db) implementing the same shapes; Phase D swaps lib/db/repo.ts to query
-- these tables via supabase-js. RLS scopes every row to the owning tech.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- techs (one row per self-employed beauty tech; maps to auth.users.id)
-- ---------------------------------------------------------------------------
create table if not exists public.techs (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null default '',
  handle text not null unique,
  business_name text not null default '',
  bio text not null default '',
  brand_color text not null default '#db2777',
  instagram text not null default '',
  tiktok text not null default '',
  location text not null default '',
  default_deposit_pct int not null default 30,
  cancellation_window_hours int not null default 48,
  no_show_fee_pct int not null default 100,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- service_categories (holds patch-test rule defaults per category)
-- ---------------------------------------------------------------------------
create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  tech_id uuid not null references public.techs (id) on delete cascade,
  name text not null,
  patch_test_validity_days int not null default 180,
  patch_test_min_lead_hours int not null default 24,
  created_at timestamptz not null default now()
);
create index if not exists idx_categories_tech on public.service_categories (tech_id);

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------
create type deposit_type as enum ('percent', 'fixed', 'none');

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  tech_id uuid not null references public.techs (id) on delete cascade,
  category_id uuid not null references public.service_categories (id) on delete cascade,
  name text not null,
  description text not null default '',
  duration_min int not null,
  price_pennies int not null,
  deposit_type deposit_type not null default 'percent',
  deposit_value int not null default 30,
  requires_patch_test boolean not null default false,
  is_infill boolean not null default false,
  full_set_service_id uuid references public.services (id) on delete set null,
  infill_max_gap_days int not null default 21,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_services_tech on public.services (tech_id);

-- ---------------------------------------------------------------------------
-- availability
-- ---------------------------------------------------------------------------
create table if not exists public.working_hours (
  id uuid primary key default gen_random_uuid(),
  tech_id uuid not null references public.techs (id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_minutes int not null,
  end_minutes int not null,
  enabled boolean not null default true
);
create index if not exists idx_working_hours_tech on public.working_hours (tech_id);

create table if not exists public.time_off (
  id uuid primary key default gen_random_uuid(),
  tech_id uuid not null references public.techs (id) on delete cascade,
  start_iso timestamptz not null,
  end_iso timestamptz not null,
  reason text not null default ''
);
create index if not exists idx_time_off_tech on public.time_off (tech_id);

-- ---------------------------------------------------------------------------
-- clients (with blacklist / warning notes)
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  tech_id uuid not null references public.techs (id) on delete cascade,
  name text not null,
  email text not null default '',
  phone text not null default '',
  notes text not null default '',
  is_blacklisted boolean not null default false,
  warning_note text not null default '',
  no_show_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_clients_tech on public.clients (tech_id);

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
create type booking_status as enum ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
create type deposit_status as enum ('none', 'paid', 'forfeited', 'refunded');
create type balance_status as enum ('none', 'unpaid', 'paid');

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  tech_id uuid not null references public.techs (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  start_iso timestamptz not null,
  end_iso timestamptz not null,
  status booking_status not null default 'confirmed',
  price_pennies int not null,
  deposit_pennies int not null default 0,
  deposit_status deposit_status not null default 'none',
  balance_pennies int not null default 0,
  balance_status balance_status not null default 'none',
  balance_token text not null unique,
  is_patch_test boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_bookings_tech on public.bookings (tech_id);
create index if not exists idx_bookings_client on public.bookings (client_id);
create index if not exists idx_bookings_start on public.bookings (start_iso);

-- ---------------------------------------------------------------------------
-- payments (deposit / balance / refund)
-- ---------------------------------------------------------------------------
create type payment_kind as enum ('deposit', 'balance', 'refund');
create type payment_status as enum ('succeeded', 'failed', 'refunded');

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  tech_id uuid not null references public.techs (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  kind payment_kind not null,
  amount_pennies int not null,
  status payment_status not null default 'succeeded',
  provider text not null default 'stub',
  provider_ref text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_payments_tech on public.payments (tech_id);

-- ---------------------------------------------------------------------------
-- patch_tests
-- ---------------------------------------------------------------------------
create type patch_test_result as enum ('pending', 'pass', 'fail');

create table if not exists public.patch_tests (
  id uuid primary key default gen_random_uuid(),
  tech_id uuid not null references public.techs (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  category_id uuid not null references public.service_categories (id) on delete cascade,
  performed_at_iso timestamptz not null,
  expires_at_iso timestamptz not null,
  result patch_test_result not null default 'pending',
  booking_id uuid references public.bookings (id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_patch_tests_client on public.patch_tests (client_id);

-- ---------------------------------------------------------------------------
-- reminders
-- ---------------------------------------------------------------------------
create type reminder_channel as enum ('email', 'sms');
create type reminder_status as enum ('scheduled', 'sent', 'skipped');
create type reminder_kind as enum ('confirmation', 'reminder_24h', 'reminder_2h', 'balance_request');

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  tech_id uuid not null references public.techs (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  channel reminder_channel not null,
  kind reminder_kind not null,
  send_at_iso timestamptz not null,
  status reminder_status not null default 'scheduled',
  preview text not null default '',
  sent_at_iso timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_reminders_due on public.reminders (status, send_at_iso);

-- ---------------------------------------------------------------------------
-- Row Level Security: every table is scoped to the owning tech.
-- ---------------------------------------------------------------------------
alter table public.techs enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.working_hours enable row level security;
alter table public.time_off enable row level security;
alter table public.clients enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.patch_tests enable row level security;
alter table public.reminders enable row level security;

-- Helper: current tech id from the JWT
create or replace function public.current_tech_id()
returns uuid
language sql stable
as $$
  select id from public.techs where auth_user_id = auth.uid()
$$;

-- techs: a tech can see/update only their own row
create policy techs_self on public.techs
  for all using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Generic per-tech policies
do $$
declare
  t text;
begin
  foreach t in array array[
    'service_categories','services','working_hours','time_off',
    'clients','bookings','payments','patch_tests','reminders'
  ]
  loop
    execute format(
      'create policy %1$s_owner on public.%1$s for all using (tech_id = public.current_tech_id()) with check (tech_id = public.current_tech_id());',
      t
    );
  end loop;
end $$;

-- Public read access for the branded booking page is handled server-side via a
-- service-role client (the public page reads services/availability for one tech),
-- so no anonymous RLS policy is granted here.
