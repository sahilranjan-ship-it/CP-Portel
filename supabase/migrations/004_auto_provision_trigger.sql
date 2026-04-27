-- 004: Automatically provision new Auth users as Contractors (CP role)
-- This ensures that every new sign-in via Google is automatically registered 
-- in user_master and cp_master tables without waiting for client-side logic.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_user_id uuid;
  full_name_val text;
begin
  -- Extract name from metadata or email
  full_name_val := coalesce(
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'name', 
    split_part(new.email, '@', 1)
  );

  -- 1. Create user_master record
  -- Note: We use ilike check or on conflict for safety, but usually auth.users is unique
  insert into public.user_master (auth_user_id, email, full_name, role, city, active)
  values (
    new.id,
    new.email,
    full_name_val,
    'cp',
    'Not Set',
    true
  )
  on conflict (email) do update set 
    auth_user_id = excluded.auth_user_id,
    full_name = excluded.full_name
  returning id into new_user_id;

  -- 2. Create cp_master record if it doesn't exist
  insert into public.cp_master (
    cp_code, 
    cp_name, 
    linked_user_id, 
    phone, 
    city, 
    tier, 
    primary_scope, 
    company_name,
    eligible_for_project
  )
  values (
    'CP-' || upper(substr(md5(random()::text), 1, 8)),
    full_name_val,
    new_user_id,
    '0000000000',
    'Not Set',
    'Classic',
    'Full Interior',
    full_name_val,
    true
  )
  on conflict do nothing;

  return new;
exception
  when others then
    -- Log error but don't block auth (auth is critical)
    raise warning 'Error in handle_new_user trigger: %', SQLERRM;
    return new;
end;
$$;

-- Trigger on auth.users after insert
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Comment to explain the purpose
comment on function public.handle_new_user() is 'Automatically provisions user_master and cp_master records for new Auth users.';
