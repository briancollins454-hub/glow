-- Owner console Phase 4: saved views, broadcasts, settings history helper index.

-- ── Saved account views (per owner email) ───────────────────────────────────
create table if not exists public.owner_saved_views (
  id text primary key,
  "ownerEmail" text not null,
  name text not null,
  columns jsonb not null default '[]'::jsonb,
  filters jsonb not null default '{}'::jsonb,
  sort text not null default 'createdAt',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists idx_owner_saved_views_email
  on public.owner_saved_views ("ownerEmail", "updatedAt" desc);
alter table public.owner_saved_views enable row level security;

-- ── Broadcast send log ──────────────────────────────────────────────────────
create table if not exists public.owner_broadcasts (
  id text primary key,
  "actorEmail" text not null,
  subject text not null,
  body text not null,
  filter jsonb not null default '{}'::jsonb,
  "includeInternal" boolean not null default false,
  "recipientCount" integer not null default 0,
  "recipientIds" text[] not null default '{}',
  status text not null default 'previewed',
  "createdAt" timestamptz not null default now(),
  "sentAt" timestamptz,
  constraint owner_broadcasts_status_chk check (status in ('previewed', 'sent', 'cancelled'))
);

create index if not exists idx_owner_broadcasts_created
  on public.owner_broadcasts ("createdAt" desc);
alter table public.owner_broadcasts enable row level security;

-- ── Settings history: query audit_events by settings_updated ────────────────
create index if not exists idx_audit_events_settings
  on public.audit_events ("techId", "createdAt" desc)
  where action = 'settings_updated';
