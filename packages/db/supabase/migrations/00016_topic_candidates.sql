create table topic_candidates (
  id uuid primary key default uuid_generate_v4(),
  suggested_name text not null,
  suggested_slug text not null,
  category text,
  source_item_ids uuid[] default '{}',
  match_scores jsonb default '{}',
  support_count integer not null default 0,
  status text not null default 'pending',
  promoted_topic_id uuid references topics(id),
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id),
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_topic_candidates_status on topic_candidates(status)
  where status = 'pending';
create index idx_topic_candidates_slug on topic_candidates(suggested_slug);
create unique index idx_topic_candidates_pending_slug
  on topic_candidates(suggested_slug)
  where status = 'pending';
