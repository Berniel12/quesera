-- Question wrappers: user-facing question framings of canonical topics
-- Questions are handles, not truth units. All scoring/signals/snapshots come from the linked topic.

create table question_wrappers (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topics(id) on delete cascade,
  question_text text not null,
  display_context text,               -- 'popular', 'worrying', 'changing', 'onboarding'
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_qw_topic_text on question_wrappers (topic_id, question_text);
create index idx_qw_featured on question_wrappers (is_featured) where is_featured = true;
create index idx_qw_display_context on question_wrappers (display_context) where display_context is not null;

-- RLS: public read for active topic wrappers
alter table question_wrappers enable row level security;

create policy "Public can read question wrappers"
  on question_wrappers for select
  using (true);

-- Question requests: user demand signals, not public content
-- Separate from topic_candidates (which is matching-engine-driven)

create table question_requests (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  normalized_slug text not null,
  matched_topic_id uuid references topics(id),
  support_count integer not null default 1,
  status text not null default 'pending',    -- pending, promoted, rejected, merged
  promoted_wrapper_id uuid references question_wrappers(id),
  requested_by uuid references profiles(id),
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id),
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_qr_slug_pending on question_requests (normalized_slug) where status = 'pending';
create index idx_qr_status on question_requests (status);

-- RLS: authenticated users can create requests, public can read promoted ones
alter table question_requests enable row level security;

create policy "Anyone can create question requests"
  on question_requests for insert
  with check (true);

create policy "Public can read question requests"
  on question_requests for select
  using (true);
