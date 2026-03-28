-- Questions: the first-class public product object.
-- Each question points to ONE primary topic (the signal truth engine).
-- Topics remain the only publication/aggregation system.
-- Questions are a thin presentation layer on top.

create table questions (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  slug text not null unique,
  question_type text,                     -- binary_event | threshold | competition
  status text not null default 'draft',   -- draft | published | resolved | archived
  category text,                          -- denormalized from primary topic
  primary_topic_id uuid not null references topics(id) on delete cascade,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  resolution_criteria text,               -- what resolves this question?
  resolution_date timestamptz,            -- expected resolution date
  resolved_answer text,                   -- yes | no | partial (when resolved)
  resolved_at timestamptz,
  migrated_from_wrapper_id uuid,          -- provenance from old wrapper system
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_q_slug on questions (slug);
create index idx_q_status on questions (status) where status = 'published';
create index idx_q_featured on questions (is_featured) where is_featured = true;
create index idx_q_primary_topic on questions (primary_topic_id);
create index idx_q_category on questions (category);

-- RLS: public read, insert/update via service role only
alter table questions enable row level security;

create policy "Public can read published questions"
  on questions for select
  using (status = 'published' or status = 'resolved');

-- No insert/update policies for anon -- all writes via service role

create trigger set_updated_at before update on questions
  for each row execute function update_updated_at();
