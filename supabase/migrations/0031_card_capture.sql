-- Card capture no-show protection.
--
-- Instead of taking a deposit upfront, a tech can choose to save the client's
-- card at booking time (Stripe Checkout setup mode - nothing is charged) and
-- charge their configured no-show fee from the saved card if the client
-- doesn't turn up.

-- 'deposit' (default, current behaviour) or 'card_capture'.
alter table public.techs
  add column if not exists "noShowProtection" text not null default 'deposit';

-- Saved card details captured for a booking (Stripe customer + payment method
-- on the tech's connected account).
alter table public.bookings
  add column if not exists "cardCustomerId" text;
alter table public.bookings
  add column if not exists "cardPaymentMethodId" text;

-- payments.kind gains 'no_show_fee'. The live schema stores kind as text; if a
-- check constraint or the legacy payment_kind enum exists, extend them too.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'payments_kind_check') then
    alter table public.payments drop constraint payments_kind_check;
    alter table public.payments add constraint payments_kind_check
      check (kind in ('deposit', 'balance', 'refund', 'no_show_fee'));
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_type where typname = 'payment_kind') then
    alter type payment_kind add value if not exists 'no_show_fee';
  end if;
exception when others then
  -- Enum not in use on this environment; kind is plain text.
  null;
end $$;
