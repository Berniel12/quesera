-- Trigram search RPC: searches both topics.canonical_name and topic_aliases.alias
-- Returns top matches above min_similarity, deduped by topic_id (highest score wins)
create or replace function trigram_search_topics(
  search_text text,
  min_similarity real default 0.2,
  max_results integer default 40
)
returns table (
  topic_id uuid,
  topic_slug text,
  topic_category text,
  similarity_score real
) as $$
begin
  return query
  with name_matches as (
    select
      t.id as tid,
      t.slug as tslug,
      t.category as tcat,
      similarity(lower(t.canonical_name), lower(search_text)) as score
    from topics t
    where t.status = 'active'
      and t.is_public = true
      and lower(t.canonical_name) % lower(search_text)
  ),
  alias_matches as (
    select
      t.id as tid,
      t.slug as tslug,
      t.category as tcat,
      similarity(lower(a.alias), lower(search_text)) as score
    from topic_aliases a
    join topics t on t.id = a.topic_id
    where t.status = 'active'
      and t.is_public = true
      and lower(a.alias) % lower(search_text)
  ),
  combined as (
    select tid, tslug, tcat, score from name_matches
    union all
    select tid, tslug, tcat, score from alias_matches
  ),
  deduped as (
    select
      tid,
      tslug,
      tcat,
      max(score) as best_score
    from combined
    where score >= min_similarity
    group by tid, tslug, tcat
  )
  select
    tid as topic_id,
    tslug as topic_slug,
    tcat as topic_category,
    best_score as similarity_score
  from deduped
  order by best_score desc, tslug asc
  limit max_results;
end;
$$ language plpgsql stable;
