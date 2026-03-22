-- Topics: search
create index idx_topics_slug on topics(slug);
create index idx_topics_category on topics(category) where status = 'active';
create index idx_topics_trgm_name on topics using gin (canonical_name gin_trgm_ops);

-- Aliases: search
create index idx_aliases_trgm on topic_aliases using gin (alias gin_trgm_ops);
create index idx_aliases_topic on topic_aliases(topic_id);

-- Snapshots
create index idx_snapshots_topic_version on topic_snapshots(topic_id, version desc);
create index idx_snapshots_published on topic_snapshots(topic_id, published_at desc);

-- Signals
create index idx_signals_topic on topic_signals(topic_id);
create index idx_signals_snapshot on topic_signals(snapshot_id);

-- Source items
create index idx_source_items_source on source_items(source_id);
create index idx_source_items_occurred on source_items(occurred_at desc);

-- Follows
create index idx_follows_user on user_followed_topics(user_id);
create index idx_follows_topic on user_followed_topics(topic_id);

-- Collections
create index idx_collections_user on collections(user_id);
