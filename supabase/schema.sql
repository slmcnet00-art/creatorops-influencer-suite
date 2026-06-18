create table if not exists public.workspace_snapshots (
  workspace_id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.workspace_snapshots enable row level security;

create policy "Authenticated users can read workspace snapshots"
  on public.workspace_snapshots
  for select
  to authenticated
  using (true);

create policy "Authenticated users can upsert workspace snapshots"
  on public.workspace_snapshots
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update workspace snapshots"
  on public.workspace_snapshots
  for update
  to authenticated
  using (true)
  with check (true);

create table if not exists public.audit_logs (
  id bigserial primary key,
  workspace_id text not null,
  actor_id uuid,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

create policy "Authenticated users can read audit logs"
  on public.audit_logs
  for select
  to authenticated
  using (true);

create policy "Authenticated users can write audit logs"
  on public.audit_logs
  for insert
  to authenticated
  with check (true);
