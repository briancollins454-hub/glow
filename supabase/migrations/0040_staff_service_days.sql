-- Per-staff available weekdays for a service.
--
-- null availableWeekdays = that staff can book the service any day the salon
-- is open. No row = fall back to the service-level availableWeekdays (or any
-- day). When both a staff rule and a service rule exist, online booking
-- intersects them.
--
-- Backfill: copy each restricted Service.availableWeekdays onto every staff
-- member who can perform that service (or all active staff when unrestricted).

create table if not exists public.staff_service_days (
  "staffId" text not null references public.staff_members (id) on delete cascade,
  "serviceId" text not null references public.services (id) on delete cascade,
  "availableWeekdays" integer[],
  primary key ("staffId", "serviceId")
);

create index if not exists idx_staff_service_days_service
  on public.staff_service_days ("serviceId");

alter table public.staff_service_days enable row level security;

drop policy if exists staff_service_days_owner on public.staff_service_days;
create policy staff_service_days_owner on public.staff_service_days
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

-- Backfill from service-level restrictions.
do $$
declare
  svc record;
  sid text;
  has_links boolean;
begin
  for svc in
    select s.id as service_id, s."techId" as tech_id, s."availableWeekdays" as days
    from public.services s
    where s."availableWeekdays" is not null
      and cardinality(s."availableWeekdays") > 0
      and cardinality(s."availableWeekdays") < 7
  loop
    select exists (
      select 1
      from public.staff_services ss
      join public.staff_members m on m.id = ss."staffId"
      where ss."serviceId" = svc.service_id
        and m."techId" = svc.tech_id
        and m.active = true
    ) into has_links;

    if has_links then
      for sid in
        select ss."staffId"
        from public.staff_services ss
        join public.staff_members m on m.id = ss."staffId"
        where ss."serviceId" = svc.service_id
          and m."techId" = svc.tech_id
          and m.active = true
      loop
        insert into public.staff_service_days ("staffId", "serviceId", "availableWeekdays")
        values (sid, svc.service_id, svc.days)
        on conflict ("staffId", "serviceId") do nothing;
      end loop;
    else
      for sid in
        select m.id
        from public.staff_members m
        where m."techId" = svc.tech_id
          and m.active = true
      loop
        insert into public.staff_service_days ("staffId", "serviceId", "availableWeekdays")
        values (sid, svc.service_id, svc.days)
        on conflict ("staffId", "serviceId") do nothing;
      end loop;
    end if;
  end loop;
end $$;
