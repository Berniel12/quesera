-- Enable RLS
alter table topics enable row level security;
alter table topic_aliases enable row level security;
alter table topic_snapshots enable row level security;
alter table topic_signals enable row level security;
alter table topic_latest_snapshot enable row level security;
alter table public_topic_cards enable row level security;
alter table profiles enable row level security;
alter table user_followed_topics enable row level security;
alter table collections enable row level security;
alter table collection_topics enable row level security;

-- PUBLIC-SAFE: constrained to public/active topics via join
create policy "public_read_topics" on topics for select
  using (status = 'active' and is_public = true);

create policy "public_read_aliases" on topic_aliases for select
  using (exists (
    select 1 from topics t
    where t.id = topic_id and t.status = 'active' and t.is_public = true
  ));

create policy "public_read_snapshots" on topic_snapshots for select
  using (exists (
    select 1 from topics t
    where t.id = topic_id and t.status = 'active' and t.is_public = true
  ));

create policy "public_read_signals" on topic_signals for select
  using (exists (
    select 1 from topics t
    where t.id = topic_id and t.status = 'active' and t.is_public = true
  ));

create policy "public_read_latest" on topic_latest_snapshot for select
  using (exists (
    select 1 from topics t
    where t.id = topic_id and t.status = 'active' and t.is_public = true
  ));

create policy "public_read_cards" on public_topic_cards for select
  using (exists (
    select 1 from topics t
    where t.id = topic_id and t.status = 'active' and t.is_public = true
  ));

-- PROFILES: select/update own only. No insert policy — creation is trigger-driven.
create policy "users_read_own_profile" on profiles for select
  using (auth.uid() = id);
create policy "users_update_own_profile" on profiles for update
  using (auth.uid() = id);

-- FOLLOWS
create policy "users_read_own_follows" on user_followed_topics for select
  using (auth.uid() = user_id);
create policy "users_insert_own_follows" on user_followed_topics for insert
  with check (auth.uid() = user_id);
create policy "users_delete_own_follows" on user_followed_topics for delete
  using (auth.uid() = user_id);

-- COLLECTIONS
create policy "users_read_own_collections" on collections for select
  using (auth.uid() = user_id);
create policy "public_read_published_collections" on collections for select
  using (is_public = true);
create policy "users_insert_own_collections" on collections for insert
  with check (auth.uid() = user_id);
create policy "users_update_own_collections" on collections for update
  using (auth.uid() = user_id);
create policy "users_delete_own_collections" on collections for delete
  using (auth.uid() = user_id);

-- COLLECTION TOPICS
create policy "users_read_own_collection_topics" on collection_topics for select
  using (exists (
    select 1 from collections c
    where c.id = collection_id and (c.user_id = auth.uid() or c.is_public = true)
  ));
create policy "users_insert_own_collection_topics" on collection_topics for insert
  with check (exists (
    select 1 from collections c
    where c.id = collection_id and c.user_id = auth.uid()
  ));
create policy "users_delete_own_collection_topics" on collection_topics for delete
  using (exists (
    select 1 from collections c
    where c.id = collection_id and c.user_id = auth.uid()
  ));
