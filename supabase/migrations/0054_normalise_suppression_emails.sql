-- Normalise email_suppressions keys to bare lowercase addresses.
-- Display-name forms like `claire tammy <a@b.com>` previously created
-- distinct PK rows that never matched bare-address lookups.
-- Also normalise outbound_sends.destination for email rows so webhook
-- fallback matching by destination stays consistent.

create or replace function public.glow_bare_email(raw text)
returns text
language sql
immutable
as $$
  select lower(trim(both from
    case
      when raw is null or btrim(raw) = '' then ''
      when raw ~ '<' then
        coalesce(
          nullif(trim(both from substring(raw from '<([^<>]+)>')), ''),
          lower(trim(both from raw))
        )
      else trim(both from raw)
    end
  ));
$$;

-- Merge duplicate suppression rows that collapse to the same bare address.
do $$
declare
  r record;
  keeper text;
  max_soft int;
  best_suppressed boolean;
  best_permanent boolean;
  best_reason text;
  best_score int;
  cand_score int;
  best_updated timestamptz;
  best_created timestamptz;
  best_event text;
  best_resend text;
  best_outbound text;
  bare text;
begin
  for r in
    select public.glow_bare_email(email) as bare
    from public.email_suppressions
    group by 1
    having count(*) > 1
  loop
    bare := r.bare;
    if bare is null or bare = '' then
      continue;
    end if;

    best_score := -1;
    keeper := null;
    max_soft := 0;
    best_suppressed := false;
    best_permanent := false;
    best_reason := null;
    best_updated := null;
    best_created := null;
    best_event := null;
    best_resend := null;
    best_outbound := null;

    for r in
      select *
      from public.email_suppressions
      where public.glow_bare_email(email) = bare
    loop
      max_soft := greatest(max_soft, coalesce(r."consecutiveSoftFailures", 0));
      cand_score :=
        (case when r.suppressed then 100 else 0 end) +
        (case when r.permanent then 50 else 0 end) +
        (case r.reason
          when 'complaint' then 30
          when 'hard_bounce' then 20
          when 'soft_bounce' then 10
          else 0
        end) +
        least(coalesce(r."consecutiveSoftFailures", 0), 99);

      if cand_score > best_score
         or (cand_score = best_score and (best_updated is null or r."updatedAt" > best_updated)) then
        best_score := cand_score;
        keeper := r.email;
        best_suppressed := r.suppressed;
        best_permanent := r.permanent;
        best_reason := r.reason;
        best_updated := r."updatedAt";
        best_created := r."createdAt";
        best_event := r."lastEventType";
        best_resend := r."lastResendEmailId";
        best_outbound := r."lastOutboundId";
      end if;

      if best_created is null or (r."createdAt" is not null and r."createdAt" < best_created) then
        best_created := r."createdAt";
      end if;
      if best_resend is null and r."lastResendEmailId" is not null then
        best_resend := r."lastResendEmailId";
      end if;
      if best_outbound is null and r."lastOutboundId" is not null then
        best_outbound := r."lastOutboundId";
      end if;
      if best_event is null and r."lastEventType" is not null then
        best_event := r."lastEventType";
      end if;
    end loop;

    -- Delete every row for this bare address except the chosen keeper.
    delete from public.email_suppressions
    where public.glow_bare_email(email) = bare
      and email is distinct from keeper;

    -- Rewrite the keeper to the bare key (may be a no-op if already bare).
    if keeper is distinct from bare then
      -- If a bare-key row somehow already exists, drop the keeper after copying.
      if exists (select 1 from public.email_suppressions where email = bare) then
        delete from public.email_suppressions where email = keeper;
      else
        update public.email_suppressions
        set
          email = bare,
          suppressed = best_suppressed,
          permanent = best_permanent,
          reason = best_reason,
          "consecutiveSoftFailures" = max_soft,
          "lastEventType" = best_event,
          "lastResendEmailId" = best_resend,
          "lastOutboundId" = best_outbound,
          "createdAt" = coalesce(best_created, "createdAt"),
          "updatedAt" = now()
        where email = keeper;
      end if;
    else
      update public.email_suppressions
      set
        suppressed = best_suppressed,
        permanent = best_permanent,
        reason = best_reason,
        "consecutiveSoftFailures" = max_soft,
        "lastEventType" = best_event,
        "lastResendEmailId" = best_resend,
        "lastOutboundId" = best_outbound,
        "createdAt" = coalesce(best_created, "createdAt"),
        "updatedAt" = now()
      where email = keeper;
    end if;
  end loop;

  -- Single-row keys that still contain display names → rename to bare.
  for r in
    select email, public.glow_bare_email(email) as bare
    from public.email_suppressions
    where email is distinct from public.glow_bare_email(email)
      and public.glow_bare_email(email) <> ''
  loop
    if exists (select 1 from public.email_suppressions where email = r.bare) then
      -- Bare form already present; drop the display-name duplicate.
      delete from public.email_suppressions where email = r.email;
    else
      update public.email_suppressions
      set email = r.bare, "updatedAt" = now()
      where email = r.email;
    end if;
  end loop;
end $$;

-- Reject future display-name / mixed-case keys (PK already enforces uniqueness).
alter table public.email_suppressions
  drop constraint if exists email_suppressions_email_bare_chk;

alter table public.email_suppressions
  add constraint email_suppressions_email_bare_chk
  check (
    email = lower(trim(email))
    and position('<' in email) = 0
    and position('>' in email) = 0
    and position(' ' in email) = 0
  );

-- Unique on normalised email is the existing primary key; keep an explicit
-- unique index name for clarity in ops / docs.
create unique index if not exists email_suppressions_email_normalised_uidx
  on public.email_suppressions (email);

-- Normalise historical email destinations (SMS rows left alone).
update public.outbound_sends
set destination = public.glow_bare_email(destination)
where channel = 'email'
  and destination is distinct from public.glow_bare_email(destination)
  and public.glow_bare_email(destination) <> '';

comment on function public.glow_bare_email(text) is
  'Extract bare lowercase mailbox from Name <email> or plain email strings.';
