alter table public.profiles
  add column if not exists professional_type text,
  add column if not exists specialty_code text,
  add column if not exists specialty_name text,
  add column if not exists professional_registration text,
  add column if not exists practice_city text,
  add column if not exists onboarding_completed_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_professional_type_check;

alter table public.profiles
  add constraint profiles_professional_type_check
  check (professional_type is null or professional_type in ('medico_general', 'medico_especialista'));

create or replace function private.complete_clinical_onboarding(
  p_professional_type text,
  p_specialty_code text,
  p_specialty_name text,
  p_registration_number text default null,
  p_practice_city text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if p_professional_type not in ('medico_general', 'medico_especialista') then
    raise exception 'Invalid professional type';
  end if;

  if coalesce(trim(p_specialty_code), '') = '' or coalesce(trim(p_specialty_name), '') = '' then
    raise exception 'A specialty is required';
  end if;

  update public.profiles
  set professional_type = p_professional_type,
      specialty_code = trim(p_specialty_code),
      specialty_name = trim(p_specialty_name),
      professional_registration = nullif(trim(p_registration_number), ''),
      practice_city = nullif(trim(p_practice_city), ''),
      onboarding_completed_at = now()
  where id = auth.uid()
    and role = 'medico';

  if not found then
    raise exception 'Only clinician profiles can complete this onboarding';
  end if;
end;
$$;

revoke all on function private.complete_clinical_onboarding(text, text, text, text, text) from public;
grant execute on function private.complete_clinical_onboarding(text, text, text, text, text) to authenticated;
