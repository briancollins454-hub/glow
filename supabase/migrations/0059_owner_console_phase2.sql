-- Owner console Phase 2: feedback roadmap statuses, partner ledger, economics threshold.

-- ── feedback_submissions: roadmap board statuses ────────────────────────────
-- Keep legacy new/reviewing/done; add planned/shipped/declined for Phase 2.9.
alter table public.feedback_submissions
  drop constraint if exists feedback_submissions_status_check;

alter table public.feedback_submissions
  add constraint feedback_submissions_status_check
  check (status in ('new', 'reviewing', 'done', 'open', 'planned', 'shipped', 'declined'));

-- Optional theme key for aggregating duplicate requests.
alter table public.feedback_submissions
  add column if not exists "themeKey" text;

create index if not exists idx_feedback_theme
  on public.feedback_submissions ("themeKey", status);

-- ── partner_ledger_entries (commission owed / paid) ─────────────────────────
create table if not exists public.partner_ledger_entries (
  id text primary key,
  "partnerSlug" text not null,
  kind text not null,
  "amountPennies" integer not null default 0,
  "techId" text,
  note text not null default '',
  "periodMonth" text,
  "createdAt" timestamptz not null default now(),
  "createdByEmail" text,
  constraint partner_ledger_kind_chk
    check (kind in ('commission_owed', 'commission_paid', 'adjustment'))
);

create index if not exists idx_partner_ledger_slug
  on public.partner_ledger_entries ("partnerSlug", "createdAt" desc);
alter table public.partner_ledger_entries enable row level security;

-- ── owner_settings: economics threshold ─────────────────────────────────────
insert into public.owner_settings (key, value)
values
  ('costShareWarnPercent', '{"percent":40}'::jsonb)
on conflict (key) do nothing;

-- Soft signup fraud signals (optional; null until captured at signup).
alter table public.techs
  add column if not exists "signupIp" text,
  add column if not exists "signupUserAgent" text,
  add column if not exists "signupCardFingerprint" text;

comment on column public.techs."signupIp" is
  'Best-effort signup IP for referral fraud review (Phase 2.8).';
