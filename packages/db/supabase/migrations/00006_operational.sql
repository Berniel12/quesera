create table source_definitions (
  id uuid primary key default uuid_generate_v4(),
  source_key text not null unique,
  source_family text not null,
  display_name text not null,
  role_types source_role[] not null,
  auth_model text not null default 'api_key',
  cadence_seconds integer not null,
  license_class license_class not null default 'unknown',
  risk_level risk_level not null default 'medium',
  raw_payload_policy text not null default 'archive_to_storage',
  scoring_eligible boolean not null default false,
  evidence_eligible boolean not null default false,
  entity_linking_strategy text,
  rate_limit_policy jsonb default '{}',
  is_active boolean not null default true,
  config jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table source_health (
  source_id uuid primary key references source_definitions(id) on delete cascade,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  consecutive_failures integer not null default 0,
  last_error_message text,
  last_item_count integer,
  freshness freshness_status not null default 'stale',
  updated_at timestamptz not null default now()
);

create table source_items (
  id uuid primary key default uuid_generate_v4(),
  source_id uuid not null references source_definitions(id),
  external_id text not null,
  source_key text not null,
  source_item_type text,
  payload_type text not null,
  normalized_payload jsonb not null,
  content_hash text not null,
  raw_storage_path text,
  occurred_at timestamptz,
  last_seen_at timestamptz not null default now(),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_key, external_id)
);

create table admin_audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

create table version_registry (
  id uuid primary key default uuid_generate_v4(),
  component text not null,
  version text not null,
  is_active boolean not null default true,
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  unique(component, version)
);
