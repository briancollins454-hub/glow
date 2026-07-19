-- Optional staff member for a time-off / blocked slot.
-- null = blocks the whole salon diary (holidays, shared closures).
-- set = only that person's online slots are blocked (e.g. doctor's appointment).

alter table public.time_off
  add column if not exists "staffId" text references public.staff_members (id) on delete cascade;

create index if not exists idx_time_off_staff on public.time_off ("staffId");
