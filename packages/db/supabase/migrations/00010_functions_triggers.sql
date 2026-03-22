-- Auto-create profile on user signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Updated_at auto-trigger (MUTABLE tables only)
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on topics
  for each row execute function update_updated_at();
create trigger set_updated_at before update on source_definitions
  for each row execute function update_updated_at();
create trigger set_updated_at before update on source_items
  for each row execute function update_updated_at();
create trigger set_updated_at before update on source_health
  for each row execute function update_updated_at();
create trigger set_updated_at before update on profiles
  for each row execute function update_updated_at();
create trigger set_updated_at before update on collections
  for each row execute function update_updated_at();
create trigger set_updated_at before update on job_queue
  for each row execute function update_updated_at();
create trigger set_updated_at before update on public_topic_cards
  for each row execute function update_updated_at();
create trigger set_updated_at before update on topic_latest_snapshot
  for each row execute function update_updated_at();

-- Job claim function (atomic with FOR UPDATE SKIP LOCKED)
create or replace function claim_job(
  p_worker_id text,
  p_job_types job_type[] default null
)
returns setof job_queue as $$
begin
  return query
  update job_queue
  set
    status = 'claimed',
    claimed_by = p_worker_id,
    claimed_at = now(),
    attempt_count = attempt_count + 1
  where id = (
    select id from job_queue
    where status = 'pending'
      and scheduled_for <= now()
      and attempt_count < max_attempts
      and (p_job_types is null or job_type = any(p_job_types))
    order by priority desc, scheduled_for asc
    limit 1
    for update skip locked
  )
  returning *;
end;
$$ language plpgsql;
