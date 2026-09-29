-- Google-authenticated accounts for Miracle.
-- Roles live in this table, never in user_metadata, so users cannot elevate
-- themselves by editing browser-controlled profile data.

create type public.app_role as enum ('admin', 'supervisor', 'medico');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role public.app_role not null default 'medico',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Keep authorization helpers outside the public API schema.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = (select auth.uid())
$$;

revoke all on function private.current_app_role() from public;
grant execute on function private.current_app_role() to authenticated;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

create function private.set_profile_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_profile_updated
  before update on public.profiles
  for each row execute procedure private.set_profile_updated_at();

-- An administrator must not be able to accidentally remove the last account
-- able to administer the institution.
create function private.prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin'::public.app_role
    and new.role <> 'admin'::public.app_role
    and (select count(*) from public.profiles where role = 'admin'::public.app_role) <= 1 then
    raise exception 'At least one admin account is required';
  end if;

  return new;
end;
$$;

create trigger on_profile_role_change
  before update of role on public.profiles
  for each row execute procedure private.prevent_last_admin_removal();

-- Database API permissions: authenticated users can read their own profile;
-- admins can read and update all profiles through the policies below.
revoke all on table public.profiles from anon;
revoke insert, delete on table public.profiles from authenticated;
grant select, update on table public.profiles to authenticated;

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Admins can read all profiles"
on public.profiles
for select
to authenticated
using ((select private.current_app_role()) = 'admin'::public.app_role);

create policy "Admins can update profiles"
on public.profiles
for update
to authenticated
using ((select private.current_app_role()) = 'admin'::public.app_role)
with check ((select private.current_app_role()) = 'admin'::public.app_role);
