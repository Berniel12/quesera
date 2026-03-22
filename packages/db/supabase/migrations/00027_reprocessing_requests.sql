create table reprocessing_requests (
  id uuid primary key default uuid_generate_v4(),
  scope_type text not null,
  topic_id uuid references topics(id),
  source_id uuid references source_definitions(id),
  time_window_start timestamptz,
  time_window_end timestamptz,
  trigger_snapshot_generation boolean not null default false,
  trigger_summarization boolean not null default false,
  trigger_topic_matching boolean not null default false,
  status text not null default 'pending',
  jobs_enqueued_count integer default 0,
  dry_run boolean not null default false,
  requested_by uuid not null references profiles(id),
  request_notes text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_reprocessing_status on reprocessing_requests(status) where status in ('pending', 'running');
create index idx_reprocessing_created on reprocessing_requests(created_at desc);

create trigger set_updated_at before update on reprocessing_requests
  for each row execute function update_updated_at();
