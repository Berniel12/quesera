-- RLS: relationships require BOTH topics to be active + public
alter table topic_relationships enable row level security;
create policy "public_read_relationships" on topic_relationships for select
  using (
    exists (select 1 from topics t where t.id = topic_id and t.status = 'active' and t.is_public = true)
    and exists (select 1 from topics t where t.id = related_topic_id and t.status = 'active' and t.is_public = true)
  );

-- RLS: subtopics require BOTH parent and child to be active + public
alter table topic_subtopics enable row level security;
create policy "public_read_subtopics" on topic_subtopics for select
  using (
    exists (select 1 from topics t where t.id = parent_topic_id and t.status = 'active' and t.is_public = true)
    and exists (select 1 from topics t where t.id = child_topic_id and t.status = 'active' and t.is_public = true)
  );

-- topic_candidates and source_item_topic_matches: no RLS (service_role only)

-- updated_at trigger for topic_candidates (mutable table)
create trigger set_updated_at before update on topic_candidates
  for each row execute function update_updated_at();
