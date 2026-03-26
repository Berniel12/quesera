-- Oracle queries: user-asked questions with synthesized answers from prediction market data
-- Separate from question_requests (demand signals for new topics) and question_wrappers (topic framings)
-- Oracle queries get real-time LLM-synthesized verdicts backed by existing topic data

create table oracle_queries (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  question_slug text not null unique,
  matched_topic_id uuid references topics(id) on delete set null,
  status text not null default 'insufficient_data',  -- 'answered' | 'insufficient_data'
  answer_snapshot_id uuid references topic_snapshots(id) on delete set null,
  llm_verdict text,                                   -- synthesized prose; NULL = pending synthesis
  source_signals jsonb,                               -- structured: [{source, value, probability?, direction?, confidence?, updated_at}]
  synthesis_failed_at timestamptz,                    -- set when synthesis permanently fails; triggers deterministic fallback
  asked_count integer not null default 1,             -- passive demand signal (exact-slug dedup), NOT surfaced in V1 UI
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_oq_slug on oracle_queries (question_slug);
create index idx_oq_matched_topic on oracle_queries (matched_topic_id) where matched_topic_id is not null;
create index idx_oq_status on oracle_queries (status);
create index idx_oq_asked_count on oracle_queries (asked_count desc);

-- RLS: public read (shareable URLs), insert/update via server-side API routes only
alter table oracle_queries enable row level security;

create policy "Public can read oracle queries"
  on oracle_queries for select
  using (true);

-- No insert/update policies for anon/authenticated — all writes go through service role in API routes

create trigger set_updated_at before update on oracle_queries
  for each row execute function update_updated_at();

-- Oracle query subscribers: auth-gated notifications for unanswered questions
-- Mirrors alerts table pattern

create table oracle_query_subscribers (
  id uuid primary key default gen_random_uuid(),
  query_id uuid not null references oracle_queries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notified_at timestamptz,           -- NULL until notification sent
  created_at timestamptz not null default now(),
  unique(query_id, user_id)
);

create index idx_oqs_user on oracle_query_subscribers (user_id);
create index idx_oqs_query on oracle_query_subscribers (query_id);
create index idx_oqs_pending on oracle_query_subscribers (query_id) where notified_at is null;

alter table oracle_query_subscribers enable row level security;

create policy "Users read own subscriptions"
  on oracle_query_subscribers for select
  using (auth.uid() = user_id);

create policy "Users create own subscriptions"
  on oracle_query_subscribers for insert
  with check (auth.uid() = user_id);

create policy "Users delete own subscriptions"
  on oracle_query_subscribers for delete
  using (auth.uid() = user_id);

-- Rate limiting: persistent per-IP counters that survive deploys
-- Simple table, cleaned up periodically

create table oracle_rate_limits (
  ip_hash text not null,
  window_start timestamptz not null default date_trunc('minute', now()),
  request_count integer not null default 1,
  primary key (ip_hash, window_start)
);

-- No RLS needed — only accessed via service role in API routes
-- Auto-cleanup: rows older than 1 hour are irrelevant
create index idx_orl_window on oracle_rate_limits (window_start);

-- RPC: atomically increment asked_count for exact-slug dedup
create or replace function increment_asked_count(p_slug text)
returns void language sql as $$
  update oracle_queries
  set asked_count = asked_count + 1, updated_at = now()
  where question_slug = p_slug;
$$;

-- RPC: upsert rate limit counter (atomic increment per IP per minute window)
create or replace function increment_rate_limit(p_ip_hash text)
returns void language plpgsql as $$
declare
  w timestamptz := date_trunc('minute', now());
begin
  insert into oracle_rate_limits (ip_hash, window_start, request_count)
  values (p_ip_hash, w, 1)
  on conflict (ip_hash, window_start)
  do update set request_count = oracle_rate_limits.request_count + 1;
end;
$$;
