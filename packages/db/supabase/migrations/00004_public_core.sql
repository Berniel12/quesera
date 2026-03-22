create table topics (
  id uuid primary key default uuid_generate_v4(),
  canonical_name text not null,
  slug text not null unique,
  category text,
  description text,
  status topic_status not null default 'active',
  is_seeded boolean not null default false,
  is_public boolean not null default true,
  entity_refs jsonb default '[]',
  embedding vector(1536),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table topic_aliases (
  id uuid primary key default uuid_generate_v4(),
  topic_id uuid not null references topics(id) on delete cascade,
  alias text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique(topic_id, alias)
);

create table topic_snapshots (
  id uuid primary key default uuid_generate_v4(),
  topic_id uuid not null references topics(id) on delete cascade,
  version integer not null,
  direction signal_direction not null default 'unknown',
  confidence numeric(5,4),
  disagreement numeric(5,4),
  freshness freshness_status not null default 'fresh',
  staleness_seconds integer,
  current_picture_text text,
  what_changed_text text,
  what_next_text text,
  structured_data jsonb not null default '{}',
  scoring_version text,
  summarization_version text,
  model_name text,
  snapshot_at timestamptz not null default now(),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(topic_id, version)
);

create table topic_signals (
  id uuid primary key default uuid_generate_v4(),
  topic_id uuid not null references topics(id) on delete cascade,
  snapshot_id uuid not null references topic_snapshots(id) on delete cascade,
  source_family text not null,
  source_name text not null,
  signal_type text not null,
  metric_type text,
  current_value numeric,
  previous_value numeric,
  delta numeric,
  confidence_modifier numeric(5,4),
  weight numeric(5,4),
  direction signal_direction not null default 'unknown',
  freshness freshness_status not null default 'fresh',
  external_id text,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

create table topic_latest_snapshot (
  topic_id uuid primary key references topics(id) on delete cascade,
  snapshot_id uuid not null references topic_snapshots(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table public_topic_cards (
  topic_id uuid primary key references topics(id) on delete cascade,
  canonical_name text not null,
  slug text not null,
  category text,
  direction signal_direction,
  confidence numeric(5,4),
  freshness freshness_status,
  one_liner text,
  snapshot_published_at timestamptz,
  updated_at timestamptz not null default now()
);
