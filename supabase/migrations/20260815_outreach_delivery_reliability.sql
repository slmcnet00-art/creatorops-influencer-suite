alter table public.outreach_messages add column if not exists idempotency_key text;
alter table public.outreach_messages add column if not exists attempt_count integer not null default 0;
alter table public.outreach_messages add column if not exists last_error text;

create unique index if not exists outreach_messages_workspace_idempotency_idx
  on public.outreach_messages (workspace_id, idempotency_key)
  where idempotency_key is not null;
