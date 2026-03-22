create table user_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default true,
  digest_frequency text not null default 'daily',
  alert_sensitivity text not null default 'balanced',
  global_mute boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_notification_preferences enable row level security;
create policy "users_read_own_prefs" on user_notification_preferences for select using (auth.uid() = user_id);
create policy "users_upsert_own_prefs" on user_notification_preferences for insert with check (auth.uid() = user_id);
create policy "users_update_own_prefs" on user_notification_preferences for update using (auth.uid() = user_id);

create trigger set_updated_at before update on user_notification_preferences
  for each row execute function update_updated_at();
