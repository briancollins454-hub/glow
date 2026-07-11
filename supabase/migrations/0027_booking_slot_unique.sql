-- Fix 3: prevent double-booking the same tech+start slot for active statuses.
-- Fix 5: prevent duplicate Stripe payment ledger rows for the same provider_ref.
-- payment_kind already includes 'refund' (0001_init); refund rows reuse the
-- original payment intent id, so the payments unique index excludes kind='refund'.

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
    ) d
    where rn > 1
  loop
    update public.bookings
    set
      status = 'cancelled',
      notes = trim(both from coalesce(notes, '') || E'\n[auto-cancelled: duplicate slot during migration 0027]')
    where id = r.id;
    raise notice 'auto-cancelled duplicate booking % (tech %, start %)', r.id, r."techId", r."startIso";
  end loop;
end $$;

create unique index if not exists idx_bookings_tech_start_active
  on public.bookings ("techId", "startIso")
  where status in ('pending_approval', 'pending', 'confirmed', 'completed');

do $$
declare
  r record;
begin
  for r in
    select id, "providerRef"
    from (
      select
        id,
        "providerRef",
        row_number() over (
          partition by "providerRef"
          order by "createdAt" asc, id asc
        ) as rn
      from public.payments
      where provider = 'stripe'
        and "providerRef" <> ''
        and kind <> 'refund'
    ) d
    where rn > 1
  loop
    delete from public.payments where id = r.id;
    raise notice 'deleted duplicate stripe payment % (providerRef %)', r.id, r."providerRef";
  end loop;
end $$;

-- Exclude refunds: Fix 2 records refunds with the same Stripe payment intent id.
create unique index if not exists idx_payments_stripe_provider_ref
  on public.payments ("providerRef")
  where provider = 'stripe' and "providerRef" <> '' and kind <> 'refund';
