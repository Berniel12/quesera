create table topic_relationships (
  id uuid primary key default uuid_generate_v4(),
  topic_id uuid not null references topics(id) on delete cascade,
  related_topic_id uuid not null references topics(id) on delete cascade,
  relationship_type text not null,
  created_at timestamptz not null default now(),
  unique(topic_id, related_topic_id, relationship_type),
  check (topic_id <> related_topic_id)
);

create index idx_topic_relationships_topic on topic_relationships(topic_id);
create index idx_topic_relationships_related on topic_relationships(related_topic_id);
