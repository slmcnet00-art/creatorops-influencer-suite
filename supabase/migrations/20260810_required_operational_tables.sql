-- CreatorOps operational tables required by discovery, outreach, reporting, and reuse workflows.
-- Safe to run repeatedly in the Supabase SQL Editor.

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

create index if not exists creator_profile_snapshots_creator_idx
  on public.creator_profile_snapshots (workspace_id, creator_id, platform, collected_at desc);

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

create index if not exists content_metric_snapshots_content_idx
  on public.content_metric_snapshots (workspace_id, content_url, measured_at desc);

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

create index if not exists creator_contact_points_creator_idx
  on public.creator_contact_points (workspace_id, creator_id, contact_type);

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

create index if not exists creator_rates_creator_idx
  on public.creator_rates (workspace_id, creator_id, platform, effective_from desc);

create table if not exists public.creator_operations (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  campaign_id text,
  creator_id text not null,
  stage text not null default 'new' check (stage in ('new', 'verifying', 'performance', 'core', 'paused')),
  training_status text not null default 'not_started' check (training_status in ('not_started', 'in_progress', 'completed')),
  next_action text,
  next_action_at timestamptz,
  assigned_to text,
  replacement_reason text,
  actual_cost numeric not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists creator_operations_workspace_campaign_creator_idx
  on public.creator_operations(workspace_id, campaign_id, creator_id);

create table if not exists public.content_templates (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  source_content_id text,
  campaign_id text,
  name text not null,
  structure_json jsonb not null default '{}'::jsonb,
  approved boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'approved', 'archived')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_templates_workspace_status_idx
  on public.content_templates(workspace_id, status);

alter table public.creator_profile_snapshots enable row level security;
alter table public.content_metric_snapshots enable row level security;
alter table public.creator_contact_points enable row level security;
alter table public.creator_rates enable row level security;
alter table public.creator_operations enable row level security;
alter table public.content_templates enable row level security;

drop policy if exists "Members can manage creator profile snapshots" on public.creator_profile_snapshots;
create policy "Members can manage creator profile snapshots"
  on public.creator_profile_snapshots for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Members can manage content metric snapshots" on public.content_metric_snapshots;
create policy "Members can manage content metric snapshots"
  on public.content_metric_snapshots for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Members can manage creator contact points" on public.creator_contact_points;
create policy "Members can manage creator contact points"
  on public.creator_contact_points for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Members can manage creator rates" on public.creator_rates;
create policy "Members can manage creator rates"
  on public.creator_rates for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Members can read creator operations" on public.creator_operations;
create policy "Members can read creator operations"
  on public.creator_operations for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members can write creator operations" on public.creator_operations;
create policy "Members can write creator operations"
  on public.creator_operations for all to authenticated
  using (public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']))
  with check (public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']));

drop policy if exists "Members can read content templates" on public.content_templates;
create policy "Members can read content templates"
  on public.content_templates for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members can write content templates" on public.content_templates;
create policy "Members can write content templates"
  on public.content_templates for all to authenticated
  using (public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']))
  with check (public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']));

notify pgrst, 'reload schema';
