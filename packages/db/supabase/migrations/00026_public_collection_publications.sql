create table public_collection_publications (
  id uuid primary key default uuid_generate_v4(),
  collection_id uuid not null unique references collections(id) on delete cascade,
  slug text not null unique,
  title text not null,
  description text,
  topic_ids uuid[] not null default '{}',
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_collection_pubs_slug on public_collection_publications(slug);

alter table public_collection_publications enable row level security;
create policy "public_read_collection_pubs" on public_collection_publications for select using (true);

create trigger set_updated_at before update on public_collection_publications
  for each row execute function update_updated_at();
