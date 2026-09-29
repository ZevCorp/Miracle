create table if not exists public.clinical_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 3 and 120),
  description text check (description is null or char_length(trim(description)) <= 400),
  specialty_code text not null check (char_length(trim(specialty_code)) > 0),
  specialty_name text not null check (char_length(trim(specialty_name)) > 0),
  sections text[] not null check (
    array_length(sections, 1) between 2 and 30
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clinical_templates enable row level security;

revoke all on table public.clinical_templates from anon;
grant select, insert, update, delete on table public.clinical_templates to authenticated;

create index if not exists clinical_templates_owner_updated_idx
  on public.clinical_templates (owner_id, updated_at desc);

create index if not exists clinical_templates_specialty_idx
  on public.clinical_templates (owner_id, specialty_code);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_clinical_templates_updated on public.clinical_templates;
create trigger on_clinical_templates_updated
  before update on public.clinical_templates
  for each row execute procedure private.set_updated_at();

drop policy if exists "Users can read own clinical templates" on public.clinical_templates;
create policy "Users can read own clinical templates"
on public.clinical_templates
for select
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "Users can create own clinical templates" on public.clinical_templates;
create policy "Users can create own clinical templates"
on public.clinical_templates
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can update own clinical templates" on public.clinical_templates;
create policy "Users can update own clinical templates"
on public.clinical_templates
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can delete own clinical templates" on public.clinical_templates;
create policy "Users can delete own clinical templates"
on public.clinical_templates
for delete
to authenticated
using ((select auth.uid()) = owner_id);

notify pgrst, 'reload schema';
