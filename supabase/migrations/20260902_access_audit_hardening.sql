-- Restrict the full workspace snapshot to Owner/Admin and keep scoped users on brand snapshots.
-- This migration is idempotent and can be applied after supabase/schema.sql.

drop policy if exists "Members can read workspace members" on public.workspace_members;
drop policy if exists "Owners and managers can manage workspace members" on public.workspace_members;
drop policy if exists "Owners and admins can manage workspace members" on public.workspace_members;

create policy "Members read self or admins read workspace members"
  on public.workspace_members for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_workspace_member(workspace_id, array['Owner', 'Admin'])
  );

create policy "Owners and admins manage workspace members"
  on public.workspace_members for all to authenticated
  using (public.is_workspace_member(workspace_id, array['Owner', 'Admin']))
  with check (public.is_workspace_member(workspace_id, array['Owner', 'Admin']));

drop policy if exists "Members can read brand memberships" on public.brand_memberships;
drop policy if exists "Owners and admins can manage brand memberships" on public.brand_memberships;

create policy "Members read own or admins read brand memberships"
  on public.brand_memberships for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_workspace_member(workspace_id, array['Owner', 'Admin'])
  );

create policy "Owners and admins manage brand memberships"
  on public.brand_memberships for all to authenticated
  using (public.is_workspace_member(workspace_id, array['Owner', 'Admin']))
  with check (public.is_workspace_member(workspace_id, array['Owner', 'Admin']));

drop policy if exists "Members can read workspace snapshots" on public.workspace_snapshots;
drop policy if exists "Members can write workspace snapshots" on public.workspace_snapshots;

create policy "Owners and admins read workspace snapshots"
  on public.workspace_snapshots for select to authenticated
  using (public.is_workspace_member(workspace_id, array['Owner', 'Admin']));

create policy "Owners and admins write workspace snapshots"
  on public.workspace_snapshots for all to authenticated
  using (public.is_workspace_member(workspace_id, array['Owner', 'Admin']))
  with check (public.is_workspace_member(workspace_id, array['Owner', 'Admin']));

drop policy if exists "Brand operators can write brand scoped snapshots" on public.brand_scoped_snapshots;
create policy "Brand operators can write brand scoped snapshots"
  on public.brand_scoped_snapshots for all to authenticated
  using (public.has_brand_access(workspace_id, brand_id, array['Admin', 'Manager', 'Marketer']))
  with check (public.has_brand_access(workspace_id, brand_id, array['Admin', 'Manager', 'Marketer']));

drop policy if exists "Members can read audit logs" on public.audit_logs;
drop policy if exists "Members can write audit logs" on public.audit_logs;

create policy "Owners and admins read audit logs"
  on public.audit_logs for select to authenticated
  using (public.is_workspace_member(workspace_id, array['Owner', 'Admin']));

create policy "Members write own audit logs"
  on public.audit_logs for insert to authenticated
  with check (
    actor_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  );

drop policy if exists "Members can read job runs" on public.job_runs;
create policy "Owners and admins read job runs"
  on public.job_runs for select to authenticated
  using (workspace_id is null or public.is_workspace_member(workspace_id, array['Owner', 'Admin']));

