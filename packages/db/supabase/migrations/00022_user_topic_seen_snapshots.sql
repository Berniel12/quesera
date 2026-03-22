create table user_topic_seen_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references topics(id) on delete cascade,
  last_seen_snapshot_id uuid not null references topic_snapshots(id),
  seen_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create index idx_seen_snapshots_user on user_topic_seen_snapshots(user_id);

alter table user_topic_seen_snapshots enable row level security;
create policy "users_read_own_seen" on user_topic_seen_snapshots for select
  using (auth.uid() = user_id);
create policy "users_upsert_own_seen" on user_topic_seen_snapshots for insert
  with check (auth.uid() = user_id);
create policy "users_update_own_seen" on user_topic_seen_snapshots for update
  using (auth.uid() = user_id);
