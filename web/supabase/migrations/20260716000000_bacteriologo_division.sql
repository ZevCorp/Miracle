-- División de cuentas: tipo profesional "bacteriólogo".
--
-- Por qué: los bacteriólogos (informes de laboratorio: histopatología, microbiología,
-- laboratorio clínico) son una división de cuenta nueva. Solo ellos tendrán la
-- funcionalidad de generar notas a partir de una FOTO de la hoja manuscrita. El gating de
-- UI/rutas se apoya en `profiles.professional_type = 'bacteriologo'`.
--
-- Cambios (deliberadamente NO se toca create_org_member para no recrear su cuerpo que
-- inserta en auth.users; el superadmin marca el tipo con un UPDATE posterior sobre el
-- perfil, permitido por la RLS "superadmin updates profiles"):
--  1) Ampliar el CHECK de professional_type para admitir 'bacteriologo'.
--  2) Permitir 'bacteriologo' en el onboarding clínico (complete_clinical_onboarding).
--
-- Nota: el esquema vivo divergió de los archivos; la función se recrea tal como existe en
-- producción (professional_registration se ignora, role text).

-- 1) CHECK ampliado -----------------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_professional_type_check;

alter table public.profiles
  add constraint profiles_professional_type_check
  check (
    professional_type is null
    or professional_type in ('medico_general', 'medico_especialista', 'bacteriologo')
  );

-- 2) Onboarding clínico: aceptar bacteriólogo ---------------------------------------------
create or replace function public.complete_clinical_onboarding(
  p_professional_type text,
  p_specialty_code text,
  p_specialty_name text,
  p_practice_country text default null,
  p_practice_city text default null
)
returns void
language plpgsql
set search_path to ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if p_professional_type not in ('medico_general', 'medico_especialista', 'bacteriologo') then
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
$function$;
