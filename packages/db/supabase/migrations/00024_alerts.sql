create table alerts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references topics(id) on delete cascade,
  sensitivity text not null default 'balanced',
  is_muted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, topic_id)
);

create index idx_alerts_user on alerts(user_id);

alter table alerts enable row level security;
create policy "users_read_own_alerts" on alerts for select using (auth.uid() = user_id);
create policy "users_upsert_own_alerts" on alerts for insert with check (auth.uid() = user_id);
create policy "users_update_own_alerts" on alerts for update using (auth.uid() = user_id);
create policy "users_delete_own_alerts" on alerts for delete using (auth.uid() = user_id);

create trigger set_updated_at before update on alerts
  for each row execute function update_updated_at();
