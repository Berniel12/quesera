create table source_item_topic_matches (
  id uuid primary key default uuid_generate_v4(),
  source_item_id uuid not null references source_items(id) on delete cascade,
  topic_id uuid not null references topics(id) on delete cascade,
  match_method text not null,
  match_score numeric(5,4),
  match_metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  unique(source_item_id, topic_id)
);

create index idx_matches_topic on source_item_topic_matches(topic_id);
create index idx_matches_source_item on source_item_topic_matches(source_item_id);
create index idx_matches_score on source_item_topic_matches(match_score desc);
