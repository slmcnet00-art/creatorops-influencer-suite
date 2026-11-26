-- Prevent two servers from accepting simultaneous email jobs for one workspace.
create unique index if not exists outreach_one_running_job_per_workspace
  on public.job_runs(workspace_id)
  where job_name = 'outreach-gmail-batch' and status = 'running';
