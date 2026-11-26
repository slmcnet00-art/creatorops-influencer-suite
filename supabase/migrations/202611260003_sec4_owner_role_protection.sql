begin;
drop policy if exists "Owners and admins manage workspace members" on public.workspace_members;
create policy "Owners and admins manage workspace members"
  on public.workspace_members for all to authenticated
  using (
    public.is_workspace_member(workspace_id, array['Owner'])
    or (role <> 'Owner' and public.is_workspace_member(workspace_id, array['Admin']))
  )
  with check (
    public.is_workspace_member(workspace_id, array['Owner'])
    or (role <> 'Owner' and public.is_workspace_member(workspace_id, array['Admin']))
  );
commit;
