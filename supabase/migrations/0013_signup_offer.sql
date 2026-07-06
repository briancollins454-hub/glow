-- The signup offer (e.g. invited tester) belongs to the account, not the
-- browser cookie, so it can't leak to other accounts on the same device.
alter table public.techs add column if not exists "signupOffer" text not null default '';
