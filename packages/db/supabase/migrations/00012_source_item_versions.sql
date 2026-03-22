create table source_item_versions (
  id uuid primary key default uuid_generate_v4(),
  source_item_id uuid not null references source_items(id) on delete cascade,
  content_hash text not null,
  normalized_payload jsonb not null,
  raw_storage_path text,
  created_at timestamptz not null default now()
);

create index idx_source_item_versions_item on source_item_versions(source_item_id, created_at desc);
