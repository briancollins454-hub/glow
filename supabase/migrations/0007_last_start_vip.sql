-- Per-day "last appointment starts at" + per-client VIP status.
alter table public.working_hours add column if not exists "lastStartMinutes" integer;
alter table public.clients add column if not exists "isVip" boolean not null default false;
