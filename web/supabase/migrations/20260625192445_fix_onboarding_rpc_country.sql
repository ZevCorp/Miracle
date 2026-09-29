alter table public.profiles
  add column if not exists practice_country text;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Clinicians can complete own onboarding'
  ) then
    execute $policy$
      create policy "Clinicians can complete own onboarding"
      on public.profiles
      for update
      to authenticated
      using ((select auth.uid()) = id and role = 'medico')
      with check ((select auth.uid()) = id and role = 'medico')
    $policy$;
  end if;
end;
$$;

create or replace function public.complete_clinical_onboarding(
  p_professional_type text,
  p_specialty_code text,
  p_specialty_name text,
  p_practice_country text default null,
  p_practice_city text default null
)
returns void
language plpgsql
security invoker
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
      professional_registration = null,
      practice_country = nullif(trim(p_practice_country), ''),
      practice_city = nullif(trim(p_practice_city), ''),
      onboarding_completed_at = now()
  where id = auth.uid()
    and role = 'medico';

  if not found then
    raise exception 'Only clinician profiles can complete this onboarding';
  end if;
end;
$$;

revoke all on function public.complete_clinical_onboarding(text, text, text, text, text) from PUBLIC;
revoke all on function public.complete_clinical_onboarding(text, text, text, text, text) from anon;
revoke all on function public.complete_clinical_onboarding(text, text, text, text, text) from public;
grant execute on function public.complete_clinical_onboarding(text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
