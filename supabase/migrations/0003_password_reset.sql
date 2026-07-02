-- Self-serve password reset: single-use, hashed, expiring token per tech.
alter table public.techs add column if not exists "resetTokenHash" text;
alter table public.techs add column if not exists "resetTokenExpiresAt" timestamptz;
