create table user_followed_topics (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references topics(id) on delete cascade,
  followed_at timestamptz not null default now(),
  unique(user_id, topic_id)
);

create table collections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  is_public boolean not null default false,
  slug text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, slug)
);

create table collection_topics (
  id uuid primary key default uuid_generate_v4(),
  collection_id uuid not null references collections(id) on delete cascade,
  topic_id uuid not null references topics(id) on delete cascade,
  sort_order integer not null default 0,
  added_at timestamptz not null default now(),
  unique(collection_id, topic_id)
);
