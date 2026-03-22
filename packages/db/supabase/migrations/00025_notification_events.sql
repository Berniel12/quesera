create table notification_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid references topics(id) on delete cascade,
  snapshot_id uuid references topic_snapshots(id),
  trigger_type text not null,
  channel text not null default 'email',
  delivery_status text not null default 'pending',
  delivery_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_notification_events_user on notification_events(user_id, created_at desc);
create index idx_notification_events_dedupe on notification_events(user_id, snapshot_id, channel)
  where delivery_status != 'failed';

alter table notification_events enable row level security;
create policy "users_read_own_events" on notification_events for select using (auth.uid() = user_id);

create trigger set_updated_at before update on notification_events
  for each row execute function update_updated_at();
