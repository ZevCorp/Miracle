-- El médico edita SU propio perfil profesional.
--
-- Por qué una RPC y no un update directo: hoy `profiles` solo tiene dos
-- políticas de UPDATE útiles y ninguna sirve para esto.
--
--   * "Clinicians can complete own onboarding" — auto-edición, pero exige
--     `role = 'medico'`. Un supervisor NO puede tocar su propia fila, y un
--     médico B2C nace con `role = 'admin'` (handle_new_user), así que tampoco
--     entra por aquí.
--   * "profiles_update_admin" — un admin escribe sobre TODA su organización.
--     Editar el perfil propio a través de esa puerta significa abrirla del todo
--     desde una pantalla personal.
--
-- Además, ninguna de las dos acota COLUMNAS: con un update directo, la pantalla
-- de Configuración podría escribir cualquier campo de la tabla de identidad.
-- Esta función es la lista blanca. Nunca toca role, organization_id, email,
-- is_demo ni disabled_at — los tres triggers de guarda que ya vigilan esas
-- columnas siguen ahí, pero la primera línea de defensa es no escribirlas.

create or replace function public.update_own_profile(
  p_full_name text,
  p_identification_number text default null,
  p_professional_registration text default null,
  p_specialty_code text default null,
  p_specialty_name text default null,
  p_practice_country text default null,
  p_practice_city text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_actual record;
begin
  if v_uid is null then
    raise exception 'Se requiere una sesión activa.' using errcode = '42501';
  end if;

  if coalesce(length(trim(p_full_name)), 0) < 3 then
    raise exception 'El nombre es demasiado corto.' using errcode = '22023';
  end if;

  if length(trim(p_full_name)) > 120 then
    raise exception 'El nombre no puede pasar de 120 caracteres.' using errcode = '22023';
  end if;

  select professional_type, is_demo, disabled_at, specialty_code, specialty_name
    into v_actual
  from public.profiles
  where id = v_uid;

  if not found then
    raise exception 'No se encontró tu perfil.' using errcode = 'P0002';
  end if;

  -- La cuenta de demostración es COMPARTIDA con quien esté viendo la venta.
  -- Que un visitante renombre al médico que verá el siguiente no es un ajuste,
  -- es un destrozo silencioso.
  if v_actual.is_demo then
    raise exception 'La cuenta de demostración no puede editar su perfil.'
      using errcode = '42501';
  end if;

  if v_actual.disabled_at is not null then
    raise exception 'Esta cuenta está dada de baja.' using errcode = '42501';
  end if;

  -- La especialidad solo se mueve si es especialista. Para un médico general la
  -- especialidad ES "medicina-general" por definición, y para un patólogo la
  -- especialidad va atada a su división de cuenta: dejarla suelta convertiría
  -- un ajuste personal en un cambio de qué secciones existen.
  if v_actual.professional_type is distinct from 'medico_especialista' then
    p_specialty_code := v_actual.specialty_code;
    p_specialty_name := v_actual.specialty_name;
  end if;

  update public.profiles
  set full_name = trim(p_full_name),
      identification_number = nullif(trim(p_identification_number), ''),
      professional_registration = nullif(trim(p_professional_registration), ''),
      specialty_code = nullif(trim(p_specialty_code), ''),
      specialty_name = nullif(trim(p_specialty_name), ''),
      practice_country = nullif(trim(p_practice_country), ''),
      practice_city = nullif(trim(p_practice_city), ''),
      updated_at = now()
  where id = v_uid;
end;
$$;

revoke all on function public.update_own_profile(text, text, text, text, text, text, text) from public;
revoke all on function public.update_own_profile(text, text, text, text, text, text, text) from anon;
grant execute on function public.update_own_profile(text, text, text, text, text, text, text) to authenticated;
