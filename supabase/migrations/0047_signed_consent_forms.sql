-- Per-service consultation question scoping + signed consent records.

alter table public.consultation_questions
  add column if not exists "categoryId" text,
  add column if not exists "serviceId" text;

create index if not exists idx_questions_service
  on public.consultation_questions("serviceId")
  where "serviceId" is not null;

create index if not exists idx_questions_category
  on public.consultation_questions("categoryId")
  where "categoryId" is not null;

alter table public.services
  add column if not exists "requiresSignedConsent" boolean not null default false;

create table if not exists public.consent_records (
  id text primary key,
  "techId" text not null,
  "clientId" text not null,
  "bookingId" text,
  "serviceId" text not null,
  -- Full question set and answers as shown at signing time (immutable snapshot).
  "questionsSnapshot" jsonb not null default '[]'::jsonb,
  "typedName" text not null,
  -- PNG data URL (or raw base64) of the drawn signature.
  "signatureImage" text not null,
  "consentAccepted" boolean not null default false,
  -- Server-generated UTC timestamp; never trust a client-supplied time.
  "signedAt" timestamptz not null default now(),
  "createdAt" timestamptz not null default now()
);

create index if not exists idx_consent_records_client
  on public.consent_records("clientId", "signedAt" desc);

create index if not exists idx_consent_records_booking
  on public.consent_records("bookingId")
  where "bookingId" is not null;

alter table public.consent_records enable row level security;
drop policy if exists consent_records_owner on public.consent_records;
create policy consent_records_owner on public.consent_records
  for all using ("techId" = current_tech_id()::text)
  with check ("techId" = current_tech_id()::text);
