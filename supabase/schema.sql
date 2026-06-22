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
  role text not null check (role in ('Owner', 'Manager', 'Marketer', 'Analyst', 'Client')),
  invited_email text,
  status text not null default 'active' check (status in ('invited', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
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

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_snapshots enable row level security;
alter table public.provider_connections enable row level security;
alter table public.outreach_messages enable row level security;
alter table public.content_tracking enable row level security;
alter table public.performance_snapshots enable row level security;
alter table public.audit_logs enable row level security;
alter table public.job_runs enable row level security;

drop policy if exists "Authenticated users can read workspace snapshots" on public.workspace_snapshots;
drop policy if exists "Authenticated users can upsert workspace snapshots" on public.workspace_snapshots;
drop policy if exists "Authenticated users can update workspace snapshots" on public.workspace_snapshots;
drop policy if exists "Authenticated users can read audit logs" on public.audit_logs;
drop policy if exists "Authenticated users can write audit logs" on public.audit_logs;
drop policy if exists "Members can read workspaces" on public.workspaces;
drop policy if exists "Owners can update workspaces" on public.workspaces;
drop policy if exists "Authenticated users can create owned workspaces" on public.workspaces;
drop policy if exists "Members can read workspace members" on public.workspace_members;
drop policy if exists "Owners and managers can manage workspace members" on public.workspace_members;
drop policy if exists "Members can read workspace snapshots" on public.workspace_snapshots;
drop policy if exists "Members can write workspace snapshots" on public.workspace_snapshots;
drop policy if exists "Members can read provider connections" on public.provider_connections;
drop policy if exists "Members can manage own provider connections" on public.provider_connections;
drop policy if exists "Members can read outreach messages" on public.outreach_messages;
drop policy if exists "Members can write outreach messages" on public.outreach_messages;
drop policy if exists "Members can read content tracking" on public.content_tracking;
drop policy if exists "Members can write content tracking" on public.content_tracking;
drop policy if exists "Members can read performance snapshots" on public.performance_snapshots;
drop policy if exists "Members can write performance snapshots" on public.performance_snapshots;
drop policy if exists "Members can read job runs" on public.job_runs;

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
  using (public.is_workspace_member(workspace_id, array['Owner', 'Manager']))
  with check (public.is_workspace_member(workspace_id, array['Owner', 'Manager']));

create policy "Members can read workspace snapshots"
  on public.workspace_snapshots for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Members can write workspace snapshots"
  on public.workspace_snapshots for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

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

create policy "Members can read audit logs"
  on public.audit_logs for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Members can write audit logs"
  on public.audit_logs for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "Members can read job runs"
  on public.job_runs for select to authenticated
  using (workspace_id is null or public.is_workspace_member(workspace_id));
