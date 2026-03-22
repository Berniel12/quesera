create table topic_subtopics (
  id uuid primary key default uuid_generate_v4(),
  parent_topic_id uuid not null references topics(id) on delete cascade,
  child_topic_id uuid not null references topics(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(parent_topic_id, child_topic_id),
  check (parent_topic_id <> child_topic_id)
);

create index idx_topic_subtopics_parent on topic_subtopics(parent_topic_id);
