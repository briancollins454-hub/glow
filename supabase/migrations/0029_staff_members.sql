-- Salon mode: unlimited staff members with individual calendars.
--
-- Every account gets a staff_members row per person. Existing solo accounts
-- are backfilled with one "owner" staff member and all their working hours and
-- bookings are attached to them, so nothing changes until a second person is
-- added. Double-booking protection moves from per-account to per-staff so two
-- staff can serve two clients at the same time.
--
-- RUN THIS BEFORE DEPLOYING THE MATCHING CODE.

create table if not exists public.staff_members (
  id text primary key,
  "techId" text not null,
  "authUserId" uuid unique,
  name text not null,
  email text not null default '',
  role text not null default 'staff' check (role in ('owner', 'staff')),
  "photoPath" text,
  bio text not null default '',
  active boolean not null default true,
  "sortOrder" int not null default 0,
  "createdAt" timestamptz not null default now()
);

create index if not exists idx_staff_members_tech
  on public.staff_members ("techId", "sortOrder");

alter table public.staff_members enable row level security;

drop policy if exists staff_members_owner on public.staff_members;
create policy staff_members_owner on public.staff_members
  for all using ("techId" = current_tech_id()::text)
  with check ("techId" = current_tech_id()::text);

-- Which services each staff member performs. NO rows for a staff member means
-- they perform ALL services (the default, so solo techs never think about it).
create table if not exists public.staff_services (
  "staffId" text not null references public.staff_members (id) on delete cascade,
  "serviceId" text not null,
  primary key ("staffId", "serviceId")
);

alter table public.staff_services enable row level security;

drop policy if exists staff_services_owner on public.staff_services;
create policy staff_services_owner on public.staff_services
  for all using (
    exists (
      select 1 from public.staff_members m
      where m.id = "staffId" and m."techId" = current_tech_id()::text
    )
  )
  with check (
    exists (
      select 1 from public.staff_members m
      where m.id = "staffId" and m."techId" = current_tech_id()::text
    )
  );

-- Attach hours and bookings to a person.
alter table public.working_hours
  add column if not exists "staffId" text;

alter table public.bookings
  add column if not exists "staffId" text;

create index if not exists idx_working_hours_staff
  on public.working_hours ("staffId");

create index if not exists idx_bookings_staff_start
  on public.bookings ("staffId", "startIso");

-- Backfill: one owner staff member per account; point existing hours and
-- bookings at them.
do $$
declare
  r record;
  sid text;
begin
  for r in
    select id, "authUserId", name, "businessName", email from public.techs
  loop
    select id into sid
    from public.staff_members
    where "techId" = r.id and role = 'owner'
    limit 1;

    if sid is null then
      sid := 'stf_' || replace(gen_random_uuid()::text, '-', '');
      insert into public.staff_members (id, "techId", "authUserId", name, email, role, active, "sortOrder")
      values (
        sid,
        r.id,
        r."authUserId",
        coalesce(nullif(trim(r.name), ''), r."businessName", 'Owner'),
        coalesce(r.email, ''),
        'owner',
        true,
        0
      );
    end if;

    update public.working_hours set "staffId" = sid where "techId" = r.id and "staffId" is null;
    update public.bookings set "staffId" = sid where "techId" = r.id and "staffId" is null;
  end loop;
end $$;

-- Double-booking protection becomes per-staff: two staff members CAN both
-- have 10:00 appointments. The old per-account index must go.
drop index if exists idx_bookings_tech_start_active;

create unique index if not exists idx_bookings_staff_start_active
  on public.bookings ("staffId", "startIso")
  where status in ('pending_approval', 'pending', 'confirmed', 'completed')
    and "staffId" is not null;
