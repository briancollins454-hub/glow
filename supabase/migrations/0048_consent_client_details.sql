-- Address + emergency contact on signed consent records (immutable snapshot).

alter table public.consent_records
  add column if not exists "addressLine1" text not null default '',
  add column if not exists "addressLine2" text not null default '',
  add column if not exists "addressPostcode" text not null default '',
  add column if not exists "emergencyContactName" text not null default '',
  add column if not exists "emergencyContactPhone" text not null default '';
