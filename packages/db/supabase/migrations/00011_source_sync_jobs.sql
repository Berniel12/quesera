create table source_sync_jobs (
  id uuid primary key default uuid_generate_v4(),
  source_id uuid not null references source_definitions(id),
  job_queue_id uuid references job_queue(id),
  status text not null default 'running',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  items_fetched integer default 0,
  items_inserted integer default 0,
  items_updated integer default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index idx_source_sync_jobs_source on source_sync_jobs(source_id, created_at desc);
