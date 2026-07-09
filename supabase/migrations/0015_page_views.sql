-- Anonymous page view tracking for owner traffic analytics.
-- No raw IPs stored — only a daily visitor hash for rough unique counts.

create table if not exists public.page_views (
  id text primary key,
  "techId" text,
  path text not null,
  "visitorHash" text not null,
  referrer text,
  "viewedAt" timestamptz not null default now()
);

create index if not exists idx_page_views_viewed on public.page_views ("viewedAt" desc);
create index if not exists idx_page_views_tech_viewed on public.page_views ("techId", "viewedAt" desc);
create index if not exists idx_page_views_path_viewed on public.page_views (path, "viewedAt" desc);

alter table public.page_views enable row level security;

-- Service role only (no policies). Owner dashboard reads via supabaseService().

create or replace function public.traffic_period_stats(since timestamptz default null)
returns table (views bigint, visitors bigint)
language sql
stable
as $$
  select
    count(*)::bigint,
    count(distinct "visitorHash")::bigint
  from public.page_views
  where since is null or "viewedAt" >= since;
$$;

create or replace function public.traffic_daily(days int default 30)
returns table (day date, views bigint, visitors bigint)
language sql
stable
as $$
  select
    ("viewedAt" at time zone 'Europe/London')::date as day,
    count(*)::bigint,
    count(distinct "visitorHash")::bigint
  from public.page_views
  where "viewedAt" >= now() - make_interval(days => days)
  group by 1
  order by 1 desc;
$$;

create or replace function public.traffic_top_paths(limit_n int default 10, since timestamptz default null)
returns table (path text, views bigint, visitors bigint)
language sql
stable
as $$
  select
    path,
    count(*)::bigint,
    count(distinct "visitorHash")::bigint
  from public.page_views
  where since is null or "viewedAt" >= since
  group by 1
  order by 2 desc
  limit limit_n;
$$;

create or replace function public.traffic_top_techs(limit_n int default 10, since timestamptz default null)
returns table ("techId" text, views bigint, visitors bigint)
language sql
stable
as $$
  select
    "techId",
    count(*)::bigint,
    count(distinct "visitorHash")::bigint
  from public.page_views
  where "techId" is not null
    and (since is null or "viewedAt" >= since)
  group by 1
  order by 2 desc
  limit limit_n;
$$;
