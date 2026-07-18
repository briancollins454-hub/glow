-- Per-tech switch for client SMS (platform Twilio). Default on so new signups
-- get 24h / 2h / balance texts when clients leave a mobile number.
alter table public.techs
  add column if not exists "smsRemindersEnabled" boolean not null default true;
