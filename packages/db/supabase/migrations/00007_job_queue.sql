create table job_queue (
  id uuid primary key default uuid_generate_v4(),
  job_type job_type not null,
  payload jsonb not null default '{}',
  status job_status not null default 'pending',
  priority integer not null default 0,
  max_attempts integer not null default 3,
  attempt_count integer not null default 0,
  idempotency_key text unique,
  claimed_by text,
  claimed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  dead_at timestamptz,
  last_error_code text,
  last_error_message text,
  scheduled_for timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_job_queue_poll on job_queue (status, scheduled_for, priority desc)
  where status = 'pending';

create index idx_job_queue_claimed on job_queue (status, claimed_at)
  where status in ('claimed', 'running');
