create table if not exists ai_business_card_jobs (
  id text primary key,
  kind text not null check (kind in ('mockups', 'pdf')),
  dedupe_key text not null,
  client_key text not null,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  request_payload jsonb not null,
  result_payload jsonb,
  failure_reason text,
  failure_kind text,
  attempt_count integer not null default 0,
  locked_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_business_card_jobs_status_created_idx on ai_business_card_jobs (status, created_at);
create index if not exists ai_business_card_jobs_kind_dedupe_idx on ai_business_card_jobs (kind, dedupe_key, created_at desc);
create index if not exists ai_business_card_jobs_client_created_idx on ai_business_card_jobs (client_key, created_at desc);
