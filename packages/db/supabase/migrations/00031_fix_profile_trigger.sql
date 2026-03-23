-- Fix handle_new_user trigger to handle Google OAuth metadata fields
-- Google OAuth uses 'full_name' or 'name', not 'display_name'

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
exception
  when others then
    -- Log but don't block user creation
    raise warning 'Profile creation failed for user %: %', new.id, sqlerrm;
    return new;
end;
$$ language plpgsql security definer;

-- Grant necessary permissions
grant usage on schema public to supabase_auth_admin;
grant insert on public.profiles to supabase_auth_admin;
