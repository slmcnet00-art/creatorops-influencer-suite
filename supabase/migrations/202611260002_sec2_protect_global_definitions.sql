-- SEC-2: global definitions remain readable but are not client-writable.
begin;

drop policy if exists "Owners and managers can manage raw data sources" on public.raw_data_sources;
create policy "Owners and managers can manage raw data sources"
  on public.raw_data_sources for all to authenticated
  using (workspace_id is not null and public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager']))
  with check (workspace_id is not null and public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager']));

drop policy if exists "Owners and managers can manage metric definitions" on public.metric_definitions;
create policy "Owners and managers can manage metric definitions"
  on public.metric_definitions for all to authenticated
  using (workspace_id is not null and public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager']))
  with check (workspace_id is not null and public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager']));

drop policy if exists "Owners and managers can manage metric definition versions" on public.metric_definition_versions;
create policy "Owners and managers can manage metric definition versions"
  on public.metric_definition_versions for all to authenticated
  using (workspace_id is not null and public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager']))
  with check (workspace_id is not null and public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager']));

commit;
