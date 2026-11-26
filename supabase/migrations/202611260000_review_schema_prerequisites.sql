-- Ensure tables from the existing schema are present before the review policies.
-- Idempotent: existing tables and all stored data remain unchanged.
begin;

create table if not exists public.creator_profile_snapshots (
  id bigserial primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  brand_id text,
  creator_id text,
  platform text not null,
  external_creator_id text,
  handle text,
  profile_url text,
  display_name text,
  bio text,
  profile_image_url text,
  followers_count bigint,
  subscribers_count bigint,
  total_views bigint,
  content_count integer,
  joined_at timestamptz,
  country_code text,
  source_type text not null check (source_type in ('api_direct', 'api_authorized', 'public_snapshot', 'manual', 'calculated', 'ai_derived')),
  source_provider text,
  source_url text,
  confidence_score numeric(5,2),
  raw_payload jsonb not null default '{}'::jsonb,
  collected_at timestamptz not null default now()
);

create table if not exists public.content_metric_snapshots (
  id bigserial primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  brand_id text,
  campaign_id text,
  creator_id text,
  content_id text,
  platform text not null,
  content_url text not null,
  published_at timestamptz,
  measured_at timestamptz not null default now(),
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  conversions numeric(18,2),
  revenue numeric(18,2),
  source_type text not null check (source_type in ('api_direct', 'api_authorized', 'public_snapshot', 'manual', 'calculated', 'ai_derived')),
  source_provider text,
  source_url text,
  confidence_score numeric(5,2),
  raw_payload jsonb not null default '{}'::jsonb
);

create table if not exists public.audience_demographic_snapshots (
  id bigserial primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  brand_id text,
  creator_id text,
  platform text not null,
  dimension_type text not null check (dimension_type in ('gender', 'age', 'country', 'language', 'city', 'other')),
  dimension_value text not null,
  percentage numeric(7,4),
  authorized_account boolean not null default false,
  source_type text not null check (source_type in ('api_authorized', 'manual', 'calculated', 'ai_derived')),
  source_provider text,
  source_url text,
  confidence_score numeric(5,2),
  raw_payload jsonb not null default '{}'::jsonb,
  collected_at timestamptz not null default now()
);

create table if not exists public.creator_contact_points (
  id bigserial primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  brand_id text,
  creator_id text not null,
  contact_type text not null check (contact_type in ('email', 'instagram_dm', 'tiktok_dm', 'youtube_profile', 'other')),
  contact_value text not null,
  source_url text,
  verification_status text not null default 'unverified' check (verification_status in ('verified', 'unverified', 'invalid', 'opted_out')),
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_rates (
  id bigserial primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  brand_id text,
  creator_id text not null,
  platform text,
  content_format text,
  currency text not null default 'KRW',
  estimated_min numeric(18,2),
  estimated_max numeric(18,2),
  agreed_amount numeric(18,2),
  rate_source text not null check (rate_source in ('manual', 'calculated', 'creator_quote', 'contract')),
  effective_from date,
  effective_to date,
  calculation_version text,
  source_raw_ids text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_mention_evidence (
  id bigserial primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  brand_id text,
  creator_id text,
  content_url text not null,
  brand_name text not null,
  evidence_type text not null check (evidence_type in ('title', 'caption', 'hashtag', 'transcript', 'visual', 'manual')),
  evidence_excerpt text,
  detected_by text not null check (detected_by in ('api', 'ai', 'manual')),
  confidence_score numeric(5,2),
  source_raw_id text,
  collected_at timestamptz not null default now()
);

create table if not exists public.ad_disclosure_evidence (
  id bigserial primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  brand_id text,
  creator_id text,
  content_url text not null,
  disclosure_type text not null,
  evidence_excerpt text,
  detected_by text not null check (detected_by in ('api', 'ai', 'manual')),
  confidence_score numeric(5,2),
  source_raw_id text,
  collected_at timestamptz not null default now()
);

create table if not exists public.creator_quality_signals (
  id bigserial primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  brand_id text,
  creator_id text not null,
  platform text,
  signal_type text not null,
  numeric_value numeric(18,6),
  text_value text,
  status text not null default 'needs_review' check (status in ('ok', 'warning', 'risk', 'needs_review')),
  calculation_version text,
  source_raw_ids text[] not null default '{}',
  confidence_score numeric(5,2),
  calculated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.related_content_edges (
  id bigserial primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  brand_id text,
  from_content_url text,
  to_content_url text,
  from_creator_id text,
  to_creator_id text,
  edge_type text not null check (edge_type in ('similar_content', 'similar_creator', 'same_topic', 'same_brand')),
  score numeric(7,4),
  algorithm_version text,
  source_raw_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.metric_definition_versions (
  id bigserial primary key,
  workspace_id text references public.workspaces(id) on delete cascade,
  metric_id text not null,
  version text not null,
  formula text not null,
  raw_source_ids text[] not null default '{}',
  window_definition text,
  status text not null default 'draft' check (status in ('draft', 'active', 'deprecated')),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (workspace_id, metric_id, version)
);

create table if not exists public.raw_data_sources (
  id text primary key,
  workspace_id text references public.workspaces(id) on delete cascade,
  scope text not null check (scope in ('internal', 'external')),
  category text not null,
  name text not null,
  description text,
  collection_method text not null,
  collection_cycle text,
  source_location text,
  storage_location text,
  dashboard_area text,
  owner_dept text,
  ops_owner text,
  tech_owner text,
  status text not null default 'not_collected' check (status in ('ok', 'delayed', 'error', 'paused', 'not_collected', 'partial', 'needs_review')),
  quality_issue text,
  log_location text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.metric_definitions (
  id text primary key,
  workspace_id text references public.workspaces(id) on delete cascade,
  scope text not null check (scope in ('internal', 'external')),
  bundle text not null,
  name text not null,
  description text,
  formula text not null,
  raw_source_ids text[] not null default '{}',
  period text,
  refresh_cycle text,
  display_location text,
  interpretation text,
  outlier_rule text,
  reliability text,
  owner_dept text,
  status text not null default 'needs_review' check (status in ('ok', 'delayed', 'error', 'needs_review')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.creator_profile_snapshots enable row level security;
alter table public.content_metric_snapshots enable row level security;
alter table public.audience_demographic_snapshots enable row level security;
alter table public.creator_contact_points enable row level security;
alter table public.creator_rates enable row level security;
alter table public.brand_mention_evidence enable row level security;
alter table public.ad_disclosure_evidence enable row level security;
alter table public.creator_quality_signals enable row level security;
alter table public.related_content_edges enable row level security;
alter table public.metric_definition_versions enable row level security;
alter table public.raw_data_sources enable row level security;
alter table public.metric_definitions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'metric_definition_versions' and policyname = 'Members can read metric definition versions') then
    create policy "Members can read metric definition versions"
      on public.metric_definition_versions for select to authenticated
      using (workspace_id is null or public.is_workspace_member(workspace_id));
  end if;
end $$;
commit;
