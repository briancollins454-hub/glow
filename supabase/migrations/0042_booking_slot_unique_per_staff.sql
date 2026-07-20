-- Multi-staff slot uniqueness.
--
-- History:
--   0027 created idx_bookings_tech_start_active on ("techId", "startIso") for
--   active statuses. That blocked two different staff from booking the same
--   start time under one salon account (false err=slot on online booking).
--   0029 dropped it and added idx_bookings_staff_start_active on
--   ("staffId", "startIso") WHERE staffId IS NOT NULL.
--
-- This migration finishes the job:
--   1. Drop any leftover 0027 index (environments that never applied 0029).
--   2. Replace the 0029 index with one scoped by tech + staff.
--   3. Add a second partial unique index for NULL staffId rows.
--
-- Approach (two partial indexes, not COALESCE):
--   - Assigned bookings: unique ("techId", "staffId", "startIso") where
--     staffId is not null and status is active. Different staff may share a
--     start time; the same staff may not.
--   - Unassigned bookings: unique ("techId", "startIso") where staffId is
--     null and status is active. Two NULL-staff rows at the same time still
--     conflict (pre-multi-staff imports / single-tech accounts).
--   - A NULL-staff booking does NOT conflict with a staff-assigned one at the
--     same time (they live on different indexes). App-level availability still
--     treats legacy null rows as the owner's diary via rowsForStaff().
--
-- COALESCE(staffId, sentinel) was considered but rejected: a sentinel value
-- in an expression index is harder to reason about and less explicit than
-- two partial indexes that match the two cases directly.

-- Cancel duplicate unassigned active rows before the NULL-staff unique index.
do $$
declare
  r record;
begin
  for r in
    select id, "techId", "startIso"
    from (
      select
        id,
        "techId",
        "startIso",
        row_number() over (
          partition by "techId", "startIso"
          order by "createdAt" asc, id asc
        ) as rn
      from public.bookings
      where status in ('pending_approval', 'pending', 'confirmed', 'completed')
        and "staffId" is null
    ) d
    where rn > 1
  loop
    update public.bookings
    set
      status = 'cancelled',
      notes = trim(both from coalesce(notes, '') || E'\n[auto-cancelled: duplicate unassigned slot during migration 0042]')
    where id = r.id;
    raise notice 'auto-cancelled duplicate unassigned booking % (tech %, start %)',
      r.id, r."techId", r."startIso";
  end loop;
end $$;

-- Cancel duplicate assigned rows for the same tech+staff+start (defensive;
-- 0029 should already have prevented most of these).
do $$
declare
  r record;
begin
  for r in
    select id, "techId", "staffId", "startIso"
    from (
      select
        id,
        "techId",
        "staffId",
        "startIso",
        row_number() over (
          partition by "techId", "staffId", "startIso"
          order by "createdAt" asc, id asc
        ) as rn
      from public.bookings
      where status in ('pending_approval', 'pending', 'confirmed', 'completed')
        and "staffId" is not null
    ) d
    where rn > 1
  loop
    update public.bookings
    set
      status = 'cancelled',
      notes = trim(both from coalesce(notes, '') || E'\n[auto-cancelled: duplicate staff slot during migration 0042]')
    where id = r.id;
    raise notice 'auto-cancelled duplicate staff booking % (tech %, staff %, start %)',
      r.id, r."techId", r."staffId", r."startIso";
  end loop;
end $$;

drop index if exists idx_bookings_tech_start_active;
drop index if exists idx_bookings_staff_start_active;

create unique index if not exists idx_bookings_staff_start_active
  on public.bookings ("techId", "staffId", "startIso")
  where status in ('pending_approval', 'pending', 'confirmed', 'completed')
    and "staffId" is not null;

create unique index if not exists idx_bookings_unassigned_start_active
  on public.bookings ("techId", "startIso")
  where status in ('pending_approval', 'pending', 'confirmed', 'completed')
    and "staffId" is null;
