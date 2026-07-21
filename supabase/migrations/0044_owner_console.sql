-- Owner console + reliable traffic tracking.
-- Run in Supabase SQL editor after deploy.

-- Capture acquisition source on page views (referrer already exists).
alter table public.page_views
  add column if not exists "utmSource" text,
  add column if not exists "utmMedium" text,
  add column if not exists "utmCampaign" text;

create index if not exists idx_page_views_utm_source
  on public.page_views ("utmSource", "viewedAt" desc)
  where "utmSource" is not null;

-- Persisted platform errors (reportError + webhook/send failures).
create table if not exists public.platform_errors (
  id text primary key,
  signature text not null,
  message text not null,
  stack text,
  context jsonb not null default '{}'::jsonb,
  "where" text,
  "createdAt" timestamptz not null default now()
);

create index if not exists idx_platform_errors_created
  on public.platform_errors ("createdAt" desc);
create index if not exists idx_platform_errors_signature
  on public.platform_errors (signature, "createdAt" desc);

alter table public.platform_errors enable row level security;

-- Cron run history (Vercel cron + manual owner runs).
create table if not exists public.cron_runs (
  id text primary key,
  job text not null,
  trigger text not null default 'cron',
  ok boolean not null default true,
  result jsonb not null default '{}'::jsonb,
  error text,
  "durationMs" integer,
  "startedAt" timestamptz not null default now(),
  "finishedAt" timestamptz
);

create index if not exists idx_cron_runs_job_started
  on public.cron_runs (job, "startedAt" desc);

alter table public.cron_runs enable row level security;

-- Feedback / "Share an idea" submissions (also still emailed).
create table if not exists public.feedback_submissions (
  id text primary key,
  "techId" text not null references public.techs(id) on delete cascade,
  topic text not null default 'idea',
  message text not null,
  status text not null default 'new',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists idx_feedback_status_created
  on public.feedback_submissions (status, "createdAt" desc);
create index if not exists idx_feedback_tech
  on public.feedback_submissions ("techId", "createdAt" desc);

alter table public.feedback_submissions enable row level security;

-- Outbound email/SMS attempt log (best-effort; failures matter most).
create table if not exists public.outbound_sends (
  id text primary key,
  channel text not null,
  destination text,
  subject text,
  kind text,
  ok boolean not null,
  error text,
  "techId" text,
  "idempotencyKey" text,
  "createdAt" timestamptz not null default now()
);

create index if not exists idx_outbound_sends_created
  on public.outbound_sends ("createdAt" desc);
create index if not exists idx_outbound_sends_ok_created
  on public.outbound_sends (ok, "createdAt" desc);

alter table public.outbound_sends enable row level security;

-- Inbound support forwards (Resend -> SUPPORT_FORWARD_TO).
create table if not exists public.inbound_forwards (
  id text primary key,
  "resendEmailId" text,
  "fromAddress" text,
  subject text,
  ok boolean not null default true,
  error text,
  "createdAt" timestamptz not null default now()
);

create index if not exists idx_inbound_forwards_created
  on public.inbound_forwards ("createdAt" desc);

alter table public.inbound_forwards enable row level security;

-- Referrer / UTM breakdown for traffic section.
create or replace function public.traffic_top_referrers(limit_n int default 12, since timestamptz default null)
returns table (referrer text, views bigint, visitors bigint)
language sql
stable
as $$
  select
    coalesce(nullif(referrer, ''), '(direct)') as referrer,
    count(*)::bigint,
    count(distinct "visitorHash")::bigint
  from public.page_views
  where since is null or "viewedAt" >= since
  group by 1
  order by 2 desc
  limit limit_n;
$$;

create or replace function public.traffic_top_sources(limit_n int default 12, since timestamptz default null)
returns table (source text, views bigint, visitors bigint)
language sql
stable
as $$
  select
    coalesce(nullif("utmSource", ''), '(none)') as source,
    count(*)::bigint,
    count(distinct "visitorHash")::bigint
  from public.page_views
  where since is null or "viewedAt" >= since
  group by 1
  order by 2 desc
  limit limit_n;
$$;
