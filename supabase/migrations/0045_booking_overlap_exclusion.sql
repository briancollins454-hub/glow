-- Overlap backstop for active staff bookings + deliberate overbook flag.
--
-- The existing unique indexes only block identical startIso values. Two bookings
-- can still overlap in duration (e.g. 10:00–11:00 and 10:30–11:30). This
-- exclusion constraint closes that hole at the database layer.
--
-- Deliberate dashboard overbooks set "allowOverlap" = true so they are excluded
-- from both this constraint and the exact-start unique indexes.
--
-- NOT VALID: existing historical overlaps (imports, races) are left alone; the
-- constraint still applies to new inserts and updates. Validate later with
-- ALTER TABLE ... VALIDATE CONSTRAINT once cleaned up.

create extension if not exists btree_gist;

alter table public.bookings
  add column if not exists "allowOverlap" boolean not null default false;

-- Exact-start unique indexes: allow flagged overbooks to share a start minute.
drop index if exists idx_bookings_staff_start_active;
drop index if exists idx_bookings_unassigned_start_active;

create unique index if not exists idx_bookings_staff_start_active
  on public.bookings ("techId", "staffId", "startIso")
  where status in ('pending_approval', 'pending', 'confirmed', 'completed')
    and "staffId" is not null
    and not "allowOverlap";

create unique index if not exists idx_bookings_unassigned_start_active
  on public.bookings ("techId", "startIso")
  where status in ('pending_approval', 'pending', 'confirmed', 'completed')
    and "staffId" is null
    and not "allowOverlap";

-- Range overlap: same staff, overlapping [start, end), active statuses only.
-- Partial exclusion via WHERE so cancelled / no_show / flagged overbooks are free.
alter table public.bookings
  drop constraint if exists bookings_staff_no_overlap;

alter table public.bookings
  add constraint bookings_staff_no_overlap
  exclude using gist (
    "staffId" with =,
    tstzrange("startIso", "endIso", '[)') with &&
  )
  where (
    "staffId" is not null
    and not "allowOverlap"
    and status in ('pending_approval', 'pending', 'confirmed', 'completed')
  )
  not valid;
