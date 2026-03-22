create table snapshot_generation_runs (
  id uuid primary key default uuid_generate_v4(),
  topic_id uuid not null references topics(id),
  job_queue_id uuid references job_queue(id),
  snapshot_id uuid references topic_snapshots(id),
  prior_snapshot_id uuid references topic_snapshots(id),
  scoring_version text not null,
  status text not null default 'running',
  direction_changed boolean,
  confidence_delta numeric(5,4),
  summarization_triggered boolean not null default false,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_snapshot_gen_runs_topic on snapshot_generation_runs(topic_id, created_at desc);
