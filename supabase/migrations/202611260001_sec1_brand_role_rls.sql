-- SEC-1: restrict authenticated access; service-role delivery writes are unchanged.
begin;

drop policy if exists "Members can read outreach messages" on public.outreach_messages;
create policy "Members can read outreach messages"
  on public.outreach_messages for select to authenticated
  using (public.is_workspace_member(workspace_id, array['Owner', 'Admin', 'Manager', 'Marketer']));

drop policy if exists "Members can write outreach messages" on public.outreach_messages;

drop policy if exists "Members can manage creator profile snapshots" on public.creator_profile_snapshots;
create policy "Members can manage creator profile snapshots"
  on public.creator_profile_snapshots for all to authenticated
  using (public.has_brand_access(workspace_id, brand_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']))
  with check (public.has_brand_access(workspace_id, brand_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']));

drop policy if exists "Brand members can read creator profile snapshots" on public.creator_profile_snapshots;
create policy "Brand members can read creator profile snapshots"
  on public.creator_profile_snapshots for select to authenticated
  using (public.has_brand_access(workspace_id, brand_id));

drop policy if exists "Members can manage content metric snapshots" on public.content_metric_snapshots;
create policy "Members can manage content metric snapshots"
  on public.content_metric_snapshots for all to authenticated
  using (public.has_brand_access(workspace_id, brand_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']))
  with check (public.has_brand_access(workspace_id, brand_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']));

drop policy if exists "Brand members can read content metric snapshots" on public.content_metric_snapshots;
create policy "Brand members can read content metric snapshots"
  on public.content_metric_snapshots for select to authenticated
  using (public.has_brand_access(workspace_id, brand_id));

drop policy if exists "Members can manage audience demographic snapshots" on public.audience_demographic_snapshots;
create policy "Members can manage audience demographic snapshots"
  on public.audience_demographic_snapshots for all to authenticated
  using (public.has_brand_access(workspace_id, brand_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']))
  with check (public.has_brand_access(workspace_id, brand_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']));

drop policy if exists "Brand members can read audience demographic snapshots" on public.audience_demographic_snapshots;
create policy "Brand members can read audience demographic snapshots"
  on public.audience_demographic_snapshots for select to authenticated
  using (public.has_brand_access(workspace_id, brand_id));

drop policy if exists "Members can manage creator contact points" on public.creator_contact_points;
create policy "Members can manage creator contact points"
  on public.creator_contact_points for all to authenticated
  using (public.is_workspace_member(workspace_id, array['Owner', 'Admin']))
  with check (public.is_workspace_member(workspace_id, array['Owner', 'Admin']));

drop policy if exists "Brand members can read creator contact points" on public.creator_contact_points;
create policy "Brand members can read creator contact points"
  on public.creator_contact_points for select to authenticated
  using (public.has_brand_access(workspace_id, brand_id));

drop policy if exists "Members can manage creator rates" on public.creator_rates;
create policy "Members can manage creator rates"
  on public.creator_rates for all to authenticated
  using (public.is_workspace_member(workspace_id, array['Owner', 'Admin']))
  with check (public.is_workspace_member(workspace_id, array['Owner', 'Admin']));

drop policy if exists "Brand members can read creator rates" on public.creator_rates;
create policy "Brand members can read creator rates"
  on public.creator_rates for select to authenticated
  using (public.has_brand_access(workspace_id, brand_id));

drop policy if exists "Members can manage brand mention evidence" on public.brand_mention_evidence;
create policy "Members can manage brand mention evidence"
  on public.brand_mention_evidence for all to authenticated
  using (public.has_brand_access(workspace_id, brand_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']))
  with check (public.has_brand_access(workspace_id, brand_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']));

drop policy if exists "Brand members can read brand mention evidence" on public.brand_mention_evidence;
create policy "Brand members can read brand mention evidence"
  on public.brand_mention_evidence for select to authenticated
  using (public.has_brand_access(workspace_id, brand_id));

drop policy if exists "Members can manage ad disclosure evidence" on public.ad_disclosure_evidence;
create policy "Members can manage ad disclosure evidence"
  on public.ad_disclosure_evidence for all to authenticated
  using (public.has_brand_access(workspace_id, brand_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']))
  with check (public.has_brand_access(workspace_id, brand_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']));

drop policy if exists "Brand members can read ad disclosure evidence" on public.ad_disclosure_evidence;
create policy "Brand members can read ad disclosure evidence"
  on public.ad_disclosure_evidence for select to authenticated
  using (public.has_brand_access(workspace_id, brand_id));

drop policy if exists "Members can manage creator quality signals" on public.creator_quality_signals;
create policy "Members can manage creator quality signals"
  on public.creator_quality_signals for all to authenticated
  using (public.has_brand_access(workspace_id, brand_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']))
  with check (public.has_brand_access(workspace_id, brand_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']));

drop policy if exists "Brand members can read creator quality signals" on public.creator_quality_signals;
create policy "Brand members can read creator quality signals"
  on public.creator_quality_signals for select to authenticated
  using (public.has_brand_access(workspace_id, brand_id));

drop policy if exists "Members can manage related content edges" on public.related_content_edges;
create policy "Members can manage related content edges"
  on public.related_content_edges for all to authenticated
  using (public.has_brand_access(workspace_id, brand_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']))
  with check (public.has_brand_access(workspace_id, brand_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']));

drop policy if exists "Brand members can read related content edges" on public.related_content_edges;
create policy "Brand members can read related content edges"
  on public.related_content_edges for select to authenticated
  using (public.has_brand_access(workspace_id, brand_id));

drop policy if exists "Members can read UTM tracking rows" on public.utm_tracking_rows;
create policy "Members can read UTM tracking rows"
  on public.utm_tracking_rows for select to authenticated
  using (public.has_brand_access(workspace_id, brand_id));

drop policy if exists "Members can write UTM tracking rows" on public.utm_tracking_rows;
create policy "Members can write UTM tracking rows"
  on public.utm_tracking_rows for all to authenticated
  using (public.has_brand_access(workspace_id, brand_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']))
  with check (public.has_brand_access(workspace_id, brand_id, array['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst']));

commit;
