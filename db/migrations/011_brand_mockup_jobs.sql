create table if not exists brand_mockup_jobs (
  id text primary key,
  user_id uuid references users(id) on delete set null,
  client_key text not null,
  status text not null,
  request_payload jsonb not null,
  result_payload jsonb,
  failure_reason text,
  failure_kind text,
  attempt_count integer not null default 0,
  locked_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brand_mockup_jobs_status_check check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  constraint brand_mockup_jobs_client_key_not_empty_check check (length(btrim(client_key)) > 0),
  constraint brand_mockup_jobs_attempt_count_nonnegative_check check (attempt_count >= 0)
);

create index if not exists brand_mockup_jobs_status_created_at_idx on brand_mockup_jobs (status, created_at asc);
create index if not exists brand_mockup_jobs_client_key_created_at_idx on brand_mockup_jobs (client_key, created_at desc);
create index if not exists brand_mockup_jobs_user_created_at_idx on brand_mockup_jobs (user_id, created_at desc) where user_id is not null;
create index if not exists brand_mockup_jobs_running_locked_at_idx on brand_mockup_jobs (locked_at asc) where status = 'running';
