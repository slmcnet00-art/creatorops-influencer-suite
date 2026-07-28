create table if not exists public.workspaces (
  id text primary key,
  name text not null,
  owner_id uuid references auth.users(id),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id bigserial primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('Owner', 'Admin', 'Manager', 'Marketer', 'Analyst', 'Client')),
  invited_email text,
  status text not null default 'active' check (status in ('invited', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

insert into public.workspaces (id, name, settings)
values ('miping-main', '미핑기획 CreatorOps', '{}'::jsonb)
on conflict (id) do nothing;

create or replace function public.handle_creatorops_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (
    workspace_id,
    user_id,
    role,
    invited_email,
    status
  )
  select
    workspace.id,
    new.id,
    'Client',
    new.email,
    'invited'
  from public.workspaces workspace
  where workspace.id = 'miping-main'
  on conflict (workspace_id, user_id)
  do update set invited_email = excluded.invited_email;

  return new;
end;
$$;

drop trigger if exists creatorops_auth_signup on auth.users;
create trigger creatorops_auth_signup
  after insert on auth.users
  for each row execute function public.handle_creatorops_signup();

alter table public.workspace_members drop constraint if exists workspace_members_role_check;
alter table public.workspace_members
  add constraint workspace_members_role_check
  check (role in ('Owner', 'Admin', 'Manager', 'Marketer', 'Analyst', 'Client'));

create table if not exists public.brand_memberships (
  id bigserial primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  brand_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('Admin', 'Manager', 'Marketer', 'Analyst', 'Client')),
  status text not null default 'active' check (status in ('invited', 'active', 'disabled')),
  invited_email text,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, brand_id, user_id)
);

create table if not exists public.brand_scoped_snapshots (
  workspace_id text not null references public.workspaces(id) on delete cascade,
  brand_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (workspace_id, brand_id)
);

create or replace function public.is_workspace_member(target_workspace_id text, allowed_roles text[] default null)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members member
    where member.workspace_id = target_workspace_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and (allowed_roles is null or member.role = any(allowed_roles))
  );
$$;

create or replace function public.has_brand_access(target_workspace_id text, target_brand_id text, allowed_roles text[] default null)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    public.is_workspace_member(target_workspace_id, array['Owner', 'Admin'])
    or exists (
      select 1
      from public.brand_memberships member
      where member.workspace_id = target_workspace_id
        and member.brand_id = target_brand_id
        and member.user_id = auth.uid()
        and member.status = 'active'
        and (allowed_roles is null or member.role = any(allowed_roles))
    );
$$;

create table if not exists public.workspace_snapshots (
  workspace_id text primary key references public.workspaces(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.provider_connections (
  id bigserial primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null check (provider in ('google', 'microsoft', 'youtube', 'instagram', 'tiktok')),
  account_email text,
  scopes text[] not null default '{}',
  token_ref text,
  status text not null default 'connected' check (status in ('connected', 'expired', 'revoked', 'manual')),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outreach_messages (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  campaign_id text,
  creator_id text,
  channel text not null,
  recipient text,
  subject text,
  message text not null,
  status text not null default 'review',
  provider_message_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.content_tracking (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  campaign_id text,
  creator_id text,
  platform text not null,
  url text not null,
  title text,
  status text not null default 'tracking',
  latest_metrics jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.performance_snapshots (
  id bigserial primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  content_id text not null references public.content_tracking(id) on delete cascade,
  metrics jsonb not null default '{}'::jsonb,
  source text not null,
  captured_at timestamptz not null default now()
);

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

create index if not exists audience_demographic_snapshots_creator_idx
  on public.audience_demographic_snapshots (workspace_id, creator_id, platform, collected_at desc);

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

create index if not exists creator_quality_signals_creator_idx
  on public.creator_quality_signals (workspace_id, creator_id, signal_type, calculated_at desc);

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

create table if not exists public.audit_logs (
  id bigserial primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  actor_id uuid,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.job_runs (
  id bigserial primary key,
  workspace_id text,
  job_name text not null,
  status text not null check (status in ('running', 'success', 'failed')),
  detail text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
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

create table if not exists public.external_report_imports (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  report_type text not null check (report_type in ('brand_monitor_influencers', 'video_monitor_data', 'video_monitor_workbench', 'custom')),
  source_name text not null,
  original_file_name text,
  storage_path text,
  file_hash text,
  imported_by uuid references auth.users(id),
  status text not null default 'uploaded' check (status in ('uploaded', 'parsing', 'parsed', 'failed', 'archived')),
  row_count integer not null default 0,
  sheet_count integer not null default 0,
  parse_summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  parsed_at timestamptz
);

create table if not exists public.external_report_rows (
  id bigserial primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  import_id text not null references public.external_report_imports(id) on delete cascade,
  raw_source_id text references public.raw_data_sources(id),
  report_type text not null,
  sheet_name text not null,
  row_index integer not null,
  source_key text,
  payload jsonb not null default '{}'::jsonb,
  normalized_type text,
  normalized_ref text,
  quality_status text not null default 'needs_review' check (quality_status in ('ok', 'needs_review', 'error', 'ignored')),
  quality_notes text,
  created_at timestamptz not null default now(),
  unique (import_id, sheet_name, row_index)
);

create table if not exists public.external_search_events (
  id bigserial primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  raw_source_id text references public.raw_data_sources(id),
  provider text not null,
  endpoint text,
  query text not null,
  platform text,
  country text,
  category text,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  result_count integer not null default 0,
  status text not null default 'success' check (status in ('success', 'failed', 'partial')),
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.utm_tracking_rows (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  raw_source_id text references public.raw_data_sources(id),
  brand_id text,
  brand_name text,
  campaign_id text,
  campaign_name text,
  creator_id text,
  creator_name text,
  creator_handle text,
  platform text,
  platform_slug text,
  short_code text,
  short_url text,
  original_utm_url text,
  destination_url text,
  landing_url text,
  coupon_code text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  content_url text,
  content_title text,
  content_status text,
  content_metrics_source text,
  cost numeric,
  status text not null default 'link_created' check (status in ('link_created', 'content_attached', 'paused', 'archived')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists utm_tracking_rows_workspace_campaign_idx
  on public.utm_tracking_rows(workspace_id, campaign_id);

create index if not exists utm_tracking_rows_creator_idx
  on public.utm_tracking_rows(workspace_id, creator_id);

create table if not exists public.metric_snapshots (
  id bigserial primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  metric_id text not null references public.metric_definitions(id) on delete cascade,
  campaign_id text,
  brand_id text,
  creator_id text,
  content_id text,
  dimension jsonb not null default '{}'::jsonb,
  value numeric,
  value_json jsonb not null default '{}'::jsonb,
  raw_source_ids text[] not null default '{}',
  source_row_ids bigint[] not null default '{}',
  calculated_at timestamptz not null default now(),
  status text not null default 'ok' check (status in ('ok', 'delayed', 'error', 'needs_review')),
  notes text
);

create table if not exists public.data_quality_reviews (
  id bigserial primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  raw_source_id text references public.raw_data_sources(id),
  issue_type text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'in_review', 'resolved', 'ignored')),
  reason text,
  evidence jsonb not null default '{}'::jsonb,
  assigned_to uuid references auth.users(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.unsupported_metric_requests (
  id bigserial primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  platform text not null,
  metric_name text not null,
  target_type text,
  target_id text,
  requested_reason text,
  fallback_method text,
  status text not null default 'pending' check (status in ('pending', 'manual_required', 'api_required', 'approved', 'blocked', 'resolved')),
  evidence jsonb not null default '{}'::jsonb,
  raw_source_id text references public.raw_data_sources(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.ai_generation_runs (
  id bigserial primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  run_type text not null,
  model text,
  prompt_version text,
  input_raw_source_ids text[] not null default '{}',
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  status text not null default 'success' check (status in ('success', 'failed', 'partial')),
  error_message text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.export_events (
  id bigserial primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  export_type text not null,
  target_area text,
  file_name text,
  raw_source_ids text[] not null default '{}',
  metric_ids text[] not null default '{}',
  row_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.brand_memberships enable row level security;
alter table public.workspace_snapshots enable row level security;
alter table public.brand_scoped_snapshots enable row level security;
alter table public.provider_connections enable row level security;
alter table public.outreach_messages enable row level security;
alter table public.content_tracking enable row level security;
alter table public.performance_snapshots enable row level security;
alter table public.audit_logs enable row level security;
alter table public.job_runs enable row level security;
alter table public.raw_data_sources enable row level security;
alter table public.metric_definitions enable row level security;
alter table public.external_report_imports enable row level security;
alter table public.external_report_rows enable row level security;
alter table public.external_search_events enable row level security;
alter table public.utm_tracking_rows enable row level security;
alter table public.metric_snapshots enable row level security;
alter table public.data_quality_reviews enable row level security;
alter table public.unsupported_metric_requests enable row level security;
alter table public.ai_generation_runs enable row level security;
alter table public.export_events enable row level security;

drop policy if exists "Authenticated users can read workspace snapshots" on public.workspace_snapshots;
drop policy if exists "Authenticated users can upsert workspace snapshots" on public.workspace_snapshots;
drop policy if exists "Authenticated users can update workspace snapshots" on public.workspace_snapshots;
drop policy if exists "Authenticated users can read audit logs" on public.audit_logs;
drop policy if exists "Authenticated users can write audit logs" on public.audit_logs;
drop policy if exists "Members can read audit logs" on public.audit_logs;
drop policy if exists "Members can write audit logs" on public.audit_logs;
drop policy if exists "Members can read workspaces" on public.workspaces;
drop policy if exists "Owners can update workspaces" on public.workspaces;
drop policy if exists "Authenticated users can create owned workspaces" on public.workspaces;
drop policy if exists "Members can read workspace members" on public.workspace_members;
drop policy if exists "Owners and managers can manage workspace members" on public.workspace_members;
drop policy if exists "Members can read brand memberships" on public.brand_memberships;
drop policy if exists "Owners and admins can manage brand memberships" on public.brand_memberships;
drop policy if exists "Members can read workspace snapshots" on public.workspace_snapshots;
drop policy if exists "Members can write workspace snapshots" on public.workspace_snapshots;
drop policy if exists "Brand members can read brand scoped snapshots" on public.brand_scoped_snapshots;
drop policy if exists "Brand operators can write brand scoped snapshots" on public.brand_scoped_snapshots;
drop policy if exists "Members can read provider connections" on public.provider_connections;
drop policy if exists "Members can manage own provider connections" on public.provider_connections;
drop policy if exists "Members can read outreach messages" on public.outreach_messages;
drop policy if exists "Members can write outreach messages" on public.outreach_messages;
drop policy if exists "Members can read content tracking" on public.content_tracking;
drop policy if exists "Members can write content tracking" on public.content_tracking;
drop policy if exists "Members can read performance snapshots" on public.performance_snapshots;
drop policy if exists "Members can write performance snapshots" on public.performance_snapshots;
drop policy if exists "Members can read job runs" on public.job_runs;
drop policy if exists "Members can read raw data sources" on public.raw_data_sources;
drop policy if exists "Owners and managers can manage raw data sources" on public.raw_data_sources;
drop policy if exists "Members can read metric definitions" on public.metric_definitions;
drop policy if exists "Owners and managers can manage metric definitions" on public.metric_definitions;
drop policy if exists "Members can read external report imports" on public.external_report_imports;
drop policy if exists "Members can write external report imports" on public.external_report_imports;
drop policy if exists "Members can read external report rows" on public.external_report_rows;
drop policy if exists "Members can write external report rows" on public.external_report_rows;
drop policy if exists "Members can read external search events" on public.external_search_events;
drop policy if exists "Members can write external search events" on public.external_search_events;
drop policy if exists "Members can read UTM tracking rows" on public.utm_tracking_rows;
drop policy if exists "Members can write UTM tracking rows" on public.utm_tracking_rows;
drop policy if exists "Members can read metric snapshots" on public.metric_snapshots;
drop policy if exists "Members can write metric snapshots" on public.metric_snapshots;
drop policy if exists "Members can read data quality reviews" on public.data_quality_reviews;
drop policy if exists "Members can write data quality reviews" on public.data_quality_reviews;
drop policy if exists "Members can read unsupported metric requests" on public.unsupported_metric_requests;
drop policy if exists "Members can write unsupported metric requests" on public.unsupported_metric_requests;
drop policy if exists "Members can read ai generation runs" on public.ai_generation_runs;
drop policy if exists "Members can write ai generation runs" on public.ai_generation_runs;
drop policy if exists "Members can read export events" on public.export_events;
drop policy if exists "Members can write export events" on public.export_events;

create policy "Members can read workspaces"
  on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));

create policy "Authenticated users can create owned workspaces"
  on public.workspaces for insert to authenticated
  with check (owner_id = auth.uid());

create policy "Owners can update workspaces"
  on public.workspaces for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Members can read workspace members"
  on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Owners and managers can manage workspace members"
  on public.workspace_members for all to authenticated
  using (public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager']))
  with check (public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager']));

create policy "Members can read brand memberships"
  on public.brand_memberships for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Owners and admins can manage brand memberships"
  on public.brand_memberships for all to authenticated
  using (public.is_workspace_member(workspace_id, array['Owner', 'Admin']))
  with check (public.is_workspace_member(workspace_id, array['Owner', 'Admin']));

create policy "Members can read workspace snapshots"
  on public.workspace_snapshots for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Members can write workspace snapshots"
  on public.workspace_snapshots for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "Brand members can read brand scoped snapshots"
  on public.brand_scoped_snapshots for select to authenticated
  using (public.has_brand_access(workspace_id, brand_id));

create policy "Brand operators can write brand scoped snapshots"
  on public.brand_scoped_snapshots for all to authenticated
  using (public.has_brand_access(workspace_id, brand_id, array['Admin', 'Manager', 'Marketer', 'Analyst']))
  with check (public.has_brand_access(workspace_id, brand_id, array['Admin', 'Manager', 'Marketer', 'Analyst']));

create policy "Members can read provider connections"
  on public.provider_connections for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Members can manage own provider connections"
  on public.provider_connections for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

create policy "Members can read outreach messages"
  on public.outreach_messages for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Members can write outreach messages"
  on public.outreach_messages for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "Members can read content tracking"
  on public.content_tracking for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Members can write content tracking"
  on public.content_tracking for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "Members can read performance snapshots"
  on public.performance_snapshots for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Members can write performance snapshots"
  on public.performance_snapshots for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

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

drop policy if exists "Members can manage audience demographic snapshots" on public.audience_demographic_snapshots;
create policy "Members can manage audience demographic snapshots"
  on public.audience_demographic_snapshots for all to authenticated
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

drop policy if exists "Members can manage brand mention evidence" on public.brand_mention_evidence;
create policy "Members can manage brand mention evidence"
  on public.brand_mention_evidence for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Members can manage ad disclosure evidence" on public.ad_disclosure_evidence;
create policy "Members can manage ad disclosure evidence"
  on public.ad_disclosure_evidence for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Members can manage creator quality signals" on public.creator_quality_signals;
create policy "Members can manage creator quality signals"
  on public.creator_quality_signals for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Members can manage related content edges" on public.related_content_edges;
create policy "Members can manage related content edges"
  on public.related_content_edges for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Members can read metric definition versions" on public.metric_definition_versions;
create policy "Members can read metric definition versions"
  on public.metric_definition_versions for select to authenticated
  using (workspace_id is null or public.is_workspace_member(workspace_id));

drop policy if exists "Owners and managers can manage metric definition versions" on public.metric_definition_versions;
create policy "Owners and managers can manage metric definition versions"
  on public.metric_definition_versions for all to authenticated
  using (workspace_id is null or public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager']))
  with check (workspace_id is null or public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager']));

create policy "Members can read audit logs"
  on public.audit_logs for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Members can write audit logs"
  on public.audit_logs for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "Members can read job runs"
  on public.job_runs for select to authenticated
  using (workspace_id is null or public.is_workspace_member(workspace_id));

create policy "Members can read raw data sources"
  on public.raw_data_sources for select to authenticated
  using (workspace_id is null or public.is_workspace_member(workspace_id));

create policy "Owners and managers can manage raw data sources"
  on public.raw_data_sources for all to authenticated
  using (workspace_id is null or public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager']))
  with check (workspace_id is null or public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager']));

create policy "Members can read metric definitions"
  on public.metric_definitions for select to authenticated
  using (workspace_id is null or public.is_workspace_member(workspace_id));

create policy "Owners and managers can manage metric definitions"
  on public.metric_definitions for all to authenticated
  using (workspace_id is null or public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager']))
  with check (workspace_id is null or public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager']));

create policy "Members can read external report imports"
  on public.external_report_imports for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Members can write external report imports"
  on public.external_report_imports for all to authenticated
  using (public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']))
  with check (public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']));

create policy "Members can read external report rows"
  on public.external_report_rows for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Members can write external report rows"
  on public.external_report_rows for all to authenticated
  using (public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']))
  with check (public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']));

create policy "Members can read external search events"
  on public.external_search_events for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Members can write external search events"
  on public.external_search_events for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "Members can read UTM tracking rows"
  on public.utm_tracking_rows for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Members can write UTM tracking rows"
  on public.utm_tracking_rows for all to authenticated
  using (public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']))
  with check (public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']));

create policy "Members can read metric snapshots"
  on public.metric_snapshots for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Members can write metric snapshots"
  on public.metric_snapshots for all to authenticated
  using (public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']))
  with check (public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']));

create policy "Members can read data quality reviews"
  on public.data_quality_reviews for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Members can write data quality reviews"
  on public.data_quality_reviews for all to authenticated
  using (public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']))
  with check (public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']));

create policy "Members can read unsupported metric requests"
  on public.unsupported_metric_requests for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Members can write unsupported metric requests"
  on public.unsupported_metric_requests for all to authenticated
  using (public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']))
  with check (public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']));

create policy "Members can read ai generation runs"
  on public.ai_generation_runs for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Members can write ai generation runs"
  on public.ai_generation_runs for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "Members can read export events"
  on public.export_events for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Members can write export events"
  on public.export_events for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant all privileges on sequences to service_role;
alter default privileges in schema public
  grant execute on functions to service_role;
