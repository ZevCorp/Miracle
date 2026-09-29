-- Áreas médicas dentro de una institución: el servicio del hospital como
-- unidad de mando, con su propio administrador.
--
-- ============================================================================
-- EL PROBLEMA
-- ============================================================================
--
-- Hasta hoy un hospital tenía un solo grado de mando: `admin`, y ese admin veía
-- TODA la institución. Cuando el Hospital General de Medellín entró con 53
-- cuentas (urgencias y patología conviviendo en la misma organización), la
-- enfermera jefe de urgencias tuvo que crearse como `admin` para poder
-- supervisar a su servicio — y con eso quedó viendo también las 294 consultas
-- de patología, que no le competen.
--
-- La cadena de mando queda así:
--
--   superadmin   plataforma (Miracle), por encima de cualquier hospital
--   admin        TODA la institución; es quien crea las áreas
--   admin_area   su servicio y solo su servicio
--   supervisor   lectura de toda la institución (sin gestión de cuentas)
--   medico       lo suyo
--
-- ============================================================================
-- ADEMÁS CIERRA UN AGUJERO QUE YA ESTABA ABIERTO
-- ============================================================================
--
-- La política de lectura de `audit_events` solo filtraba por organización, sin
-- mirar el rol: cualquier médico podía leer, con un GET directo a PostgREST,
-- los 2383 eventos de auditoría del hospital entero — incluidos los de otros
-- servicios y los de otros médicos. `canAccessPath` deja /app/auditoria a admin
-- y supervisor, pero la UI nunca fue la defensa.
--
-- No se puede acotar por `actor_id`, que sería lo obvio: los médicos SÍ leen
-- esta tabla para dos cosas legítimas — la línea de tiempo de su propia
-- consulta (app/app/providers.tsx) y, sobre todo, la comprobación de que una
-- nota no es de demostración antes de firmarla (app/app/consultas/actions.ts).
-- Si esa comprobación deja de ver el evento, devuelve cero y **una nota de
-- demostración se podría firmar como historia clínica real**. Por eso el
-- criterio es la consulta, no el actor: un evento se lee si y solo si se
-- alcanza la consulta a la que pertenece. Así compone además con las áreas sin
-- una segunda regla que mantener.

-- ============================================================================
-- 1. Los servicios de una institución
-- ============================================================================

create table if not exists public.org_areas (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint org_areas_name_no_vacio check (length(btrim(name)) > 0),
  constraint org_areas_nombre_unico unique (organization_id, name),
  -- Existe para que profiles pueda apuntar con una clave foránea COMPUESTA y
  -- sea imposible por construcción asignarle a alguien un área de otro
  -- hospital. Sin esto haría falta un trigger que revalidara en cada UPDATE.
  constraint org_areas_id_org_unico unique (id, organization_id)
);

create index if not exists org_areas_org_idx on public.org_areas (organization_id);

drop trigger if exists set_updated_at on public.org_areas;
create trigger set_updated_at before update on public.org_areas
  for each row execute function private.set_updated_at();

alter table public.org_areas enable row level security;

-- Todo miembro ve las áreas de su hospital: el médico necesita saber en cuál
-- está, y el selector de /app/usuarios las lista.
drop policy if exists "org reads areas" on public.org_areas;
create policy "org reads areas" on public.org_areas
  for select to authenticated
  using (organization_id = (select private.current_org()));

drop policy if exists "superadmin reads areas" on public.org_areas;
create policy "superadmin reads areas" on public.org_areas
  for select to authenticated
  using ((select private.is_superadmin()));

-- Crear, renombrar y borrar áreas es del admin de la institución. Un admin de
-- área NO puede inventarse áreas ni renombrar la suya: eso es organigrama, y el
-- organigrama es del hospital.
drop policy if exists "admin manages areas" on public.org_areas;
create policy "admin manages areas" on public.org_areas
  for all to authenticated
  using (organization_id = (select private.current_org()) and private.is_admin())
  with check (organization_id = (select private.current_org()) and private.is_admin());

-- ============================================================================
-- 2. El área de cada persona
-- ============================================================================

alter table public.profiles add column if not exists area_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_area_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_area_fkey
      foreign key (area_id, organization_id)
      references public.org_areas (id, organization_id)
      -- Borrar un área no borra a nadie: los deja sin servicio asignado. La
      -- lista de columnas (PostgreSQL 15+) es imprescindible aquí, porque un
      -- SET NULL a secas intentaría anular también organization_id, que es NOT
      -- NULL, y el borrado fallaría.
      on delete set null (area_id);
  end if;
end $$;

create index if not exists profiles_area_idx on public.profiles (area_id);

-- Mover a alguien de hospital lo deja sin área. Sin esto, el superadmin que usa
-- superadmin_move_user chocaría contra la clave foránea compuesta: el área
-- vieja no existe en la organización nueva.
create or replace function private.clear_area_on_org_change()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.organization_id is distinct from old.organization_id then
    new.area_id := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists clear_area_on_org_change on public.profiles;
create trigger clear_area_on_org_change
  before update on public.profiles
  for each row execute function private.clear_area_on_org_change();

-- ============================================================================
-- 3. El rol `admin_area`
-- ============================================================================

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array[
    'admin', 'supervisor', 'medico', 'superadmin', 'secretaria', 'admin_area'
  ]));

-- org_memberships la mantiene el trigger private.sync_org_membership copiando
-- profiles.role. Sin ampliar también este CHECK, marcar a alguien como
-- admin_area reventaría con un error de restricción que no menciona el rol.
alter table public.org_memberships drop constraint if exists org_memberships_role_check;
alter table public.org_memberships add constraint org_memberships_role_check
  check (role = any (array['admin', 'supervisor', 'medico', 'secretaria', 'admin_area']));

-- ============================================================================
-- 4. Las dos funciones que deciden el alcance
-- ============================================================================

create or replace function private.current_area()
returns uuid
language sql
stable security definer
set search_path to ''
as $function$
  select area_id from public.profiles where id = (select auth.uid())
$function$;

-- ¿Alcanza el que llama a las cosas de este profesional?
--
-- Es el único sitio donde vive la regla de mando. Las políticas de RLS pasaron
-- de repetir ARRAY['admin','supervisor'] a preguntarle a esta función, de modo
-- que añadir mañana otro grado no obliga a revisar tabla por tabla.
--
-- SECURITY DEFINER a propósito: lee profiles saltándose la RLS, que es lo que
-- evita la recursión cuando la política de la propia tabla profiles la invoca.
--
-- Un admin_area sin área asignada no alcanza a NADIE (falla cerrado), en vez de
-- alcanzar a todos, que sería el fallo peligroso.
create or replace function private.supervises(p_owner uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select case (select private.current_app_role())
    when 'admin'      then true
    when 'supervisor' then true
    when 'admin_area' then
      (select private.current_area()) is not null
      and exists (
        select 1 from public.profiles p
        where p.id = p_owner
          and p.area_id = (select private.current_area())
      )
    else false
  end
$function$;

-- ¿Alcanza el que llama a esta consulta? Reproduce la regla de lectura de
-- consultations en una sola función, para que audit_events no tenga que
-- mantener una copia de esa lógica que luego se desincronice.
create or replace function private.alcanza_consulta(p_consultation uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.consultations c
    where c.id = p_consultation
      and c.organization_id = (select private.current_org())
      and (
        c.medico_id = (select auth.uid())
        or (select private.supervises(c.medico_id))
        or (
          (select private.current_app_role()) = 'secretaria'
          and exists (
            select 1 from public.secretary_doctor_access sda
            where sda.secretary_id = (select auth.uid())
              and sda.medico_id = c.medico_id
          )
        )
      )
  )
$function$;

-- EL GRANT NO ES OPCIONAL, y omitirlo rompe la aplicación entera.
--
-- Una función nace con EXECUTE para PUBLIC. El `revoke ... from public` de
-- abajo se lo quita a todo el mundo, `authenticated` incluido — y como estas
-- tres las invocan las políticas de RLS, que se evalúan con los permisos de
-- quien consulta, sin el grant CUALQUIER lectura de consultas, pacientes o
-- perfiles falla con "permission denied for function supervises".
--
-- Pasó exactamente eso al aplicar esta migración: el revoke iba solo, y la
-- primera comprobación de alcance reventó. Es el mismo par revoke+grant que ya
-- tienen private.current_org y private.current_app_role.
revoke all on function private.current_area() from public, anon;
revoke all on function private.supervises(uuid) from public, anon;
revoke all on function private.alcanza_consulta(uuid) from public, anon;

grant execute on function private.current_area() to authenticated;
grant execute on function private.supervises(uuid) to authenticated;
grant execute on function private.alcanza_consulta(uuid) to authenticated;

-- ============================================================================
-- 5. Las políticas
-- ============================================================================
--
-- En todas, la sustitución es la misma:
--   ANTES  current_app_role() = ANY (ARRAY['admin','supervisor'])
--   AHORA  private.supervises(<dueño de la fila>)
--
-- Para admin y supervisor `supervises` devuelve true pase lo que pase, así que
-- su alcance NO cambia. Lo único nuevo es que admin_area queda acotado.

alter policy "read consultations" on public.consultations
  using (
    deleted_at is null
    and organization_id = (select private.current_org())
    and (
      private.supervises(medico_id)
      or medico_id = (select auth.uid())
      or (
        (select private.current_app_role()) = 'secretaria'
        and exists (
          select 1 from public.secretary_doctor_access sda
          where sda.secretary_id = (select auth.uid())
            and sda.medico_id = consultations.medico_id
        )
      )
    )
  );

alter policy "update consultations" on public.consultations
  using (
    organization_id = (select private.current_org())
    and (private.supervises(medico_id) or medico_id = (select auth.uid()))
  );

alter policy "read patients" on public.patients
  using (
    organization_id = (select private.current_org())
    and (
      private.supervises(created_by)
      or created_by = (select auth.uid())
      or (
        (select private.current_app_role()) = 'secretaria'
        and exists (
          select 1 from public.secretary_doctor_access sda
          where sda.secretary_id = (select auth.uid())
            and sda.medico_id = patients.created_by
        )
      )
    )
  );

alter policy "update patients" on public.patients
  using (
    organization_id = (select private.current_org())
    and (private.supervises(created_by) or created_by = (select auth.uid()))
  );

alter policy "read appointments" on public.appointments
  using (
    organization_id = (select private.current_org())
    and (private.supervises(medico_id) or medico_id = (select auth.uid()))
  );

alter policy "profiles_select_self" on public.profiles
  using (
    id = (select auth.uid())
    or (organization_id = (select private.current_org()) and private.supervises(id))
    or (
      (select private.current_app_role()) = 'secretaria'
      and exists (
        select 1 from public.secretary_doctor_access sda
        where sda.secretary_id = (select auth.uid())
          and sda.medico_id = profiles.id
      )
    )
  );

-- Gestión de cuentas. Lo delicado está aquí, y son tres cierres:
--
--   1. Un admin_area solo toca filas de gente que YA está en su área
--      (supervises) y cuyo rol actual es medico o supervisor. No puede tocar a
--      un admin, a otro admin_area ni a sí mismo: sin esa condición sobre el
--      rol VIEJO, un admin de institución que casualmente tuviera área
--      asignada podría ser degradado por su propio jefe de servicio.
--   2. Al escribir solo puede dejar el rol en medico o supervisor: nunca
--      fabrica admins.
--   3. Solo puede dejar a alguien en SU área o sin área. Esto es justamente
--      "sacar a alguien del área" (area_id := null) y a la vez impide traerse a
--      alguien de otro servicio para verle el historial.
alter policy "profiles_update_admin" on public.profiles
  using (
    organization_id = (select private.current_org())
    and (
      private.is_admin()
      or (
        (select private.current_app_role()) = 'admin_area'
        and private.supervises(id)
        and role in ('medico', 'supervisor')
      )
    )
  )
  with check (
    organization_id = (select private.current_org())
    and (
      (private.is_admin() and (role <> 'superadmin' or (select private.is_superadmin())))
      or (
        (select private.current_app_role()) = 'admin_area'
        and role in ('medico', 'supervisor')
        and (area_id is null or area_id = (select private.current_area()))
      )
    )
  );

-- Auditoría: se lee el evento de una consulta que se alcanza. Los eventos sin
-- consulta (hoy no existe ninguno) quedan para quien gobierna la institución.
alter policy "org reads audit" on public.audit_events
  using (
    organization_id = (select private.current_org())
    and (
      case
        when consultation_id is null
          then (select private.current_app_role()) in ('admin', 'supervisor')
        else private.alcanza_consulta(consultation_id)
      end
    )
  );

-- ============================================================================
-- 6. Que se puedan CREAR cuentas de admin_area
-- ============================================================================
--
-- Dos listas blancas de rol que hay que ampliar o el rol nuevo se degrada a
-- 'medico' en silencio, que es el peor de los fallos: la cuenta se crea, nadie
-- ve un error, y el jefe de servicio no manda en nada.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  new_org      uuid;
  display_name text;
  meta_org     uuid;
  meta_role    text;
begin
  -- Usuarios de Graph (asistente Android): sin perfil clinico ni organizacion.
  if new.raw_user_meta_data ->> 'app' = 'graph' then
    return new;
  end if;

  display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(new.email, 'medico'), '@', 1)
  );

  begin
    meta_org := nullif(new.raw_app_meta_data ->> 'organization_id', '')::uuid;
  exception when others then
    meta_org := null;
  end;

  meta_role := coalesce(nullif(new.raw_app_meta_data ->> 'role', ''), 'medico');
  if meta_role not in ('admin', 'supervisor', 'medico', 'admin_area') then
    meta_role := 'medico';
  end if;

  if meta_org is not null then
    insert into public.profiles (id, email, full_name, avatar_url, role, organization_id)
    values (
      new.id, coalesce(new.email, ''),
      coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
      new.raw_user_meta_data ->> 'avatar_url', meta_role, meta_org
    )
    on conflict (id) do nothing;
    return new;
  end if;

  -- Alta B2C: organizacion personal + MEDICO (antes 'admin'). El producto que
  -- compra un medico independiente exige rol medico: /app/consultas/nueva,
  -- /en-vivo y el onboarding clinico son de ese rol.
  insert into public.organizations (name, kind)
  values ('Consultorio de ' || display_name, 'personal')
  returning id into new_org;

  insert into public.profiles (id, email, full_name, avatar_url, role, organization_id)
  values (
    new.id, coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url', 'medico', new_org
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

-- La RPC de alta gana un sexto parámetro OPCIONAL con el área. Va con DEFAULT
-- para no romper a quien la llame con cinco argumentos (la firma vieja sigue
-- resolviendo).
--
-- Un admin_area que da de alta queda atado a SU área, igual que un admin de
-- hospital queda atado a su organización: el parámetro se ignora y se le impone
-- la propia. Y no puede crear otro admin_area — el rol se le degrada a medico.
create or replace function public.create_org_member(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_organization_id uuid,
  p_area_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  caller      uuid := (select auth.uid());
  caller_role text;
  caller_org  uuid;
  caller_area uuid;
  target_org  uuid;
  target_role text;
  target_area uuid;
  new_uid     uuid := gen_random_uuid();
  clean_email text := lower(trim(p_email));
begin
  if caller is null then
    raise exception 'Autenticación requerida';
  end if;

  select role, organization_id, area_id into caller_role, caller_org, caller_area
  from public.profiles where id = caller;

  if caller_role = 'superadmin' then
    target_org  := p_organization_id;
    target_area := p_area_id;
  elsif caller_role = 'admin' then
    target_org  := caller_org;
    target_area := p_area_id;
  elsif caller_role = 'admin_area' then
    if caller_area is null then
      raise exception 'No tienes un área asignada: pídele al administrador de la institución que te asigne una.';
    end if;
    target_org  := caller_org;
    target_area := caller_area;
  else
    raise exception 'No autorizado';
  end if;

  target_role := coalesce(nullif(p_role, ''), 'medico');
  if target_role not in ('medico', 'supervisor', 'admin', 'admin_area') then
    target_role := 'medico';
  end if;
  -- Un jefe de servicio no nombra a otro jefe de servicio.
  if caller_role = 'admin_area' and target_role not in ('medico', 'supervisor') then
    target_role := 'medico';
  end if;

  if clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Correo inválido';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'La contraseña debe tener al menos 8 caracteres';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'El nombre es obligatorio';
  end if;
  if target_org is null
     or not exists (select 1 from public.organizations where id = target_org) then
    raise exception 'Organización inválida';
  end if;
  if target_area is not null
     and not exists (
       select 1 from public.org_areas
       where id = target_area and organization_id = target_org
     ) then
    raise exception 'Esa área no pertenece a la institución';
  end if;
  if exists (select 1 from auth.users where email = clean_email) then
    raise exception 'Ya existe una cuenta con ese correo';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    -- Sin default en la base y leídas como texto por GoTrue. En NULL, el login
    -- falla con "credenciales inválidas".
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current
  ) values (
    '00000000-0000-0000-0000-000000000000', new_uid, 'authenticated', 'authenticated',
    clean_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'organization_id', target_org::text,
      'role', target_role
    ),
    jsonb_build_object('full_name', trim(p_full_name)),
    '', '', '', '', ''
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    new_uid::text, new_uid,
    jsonb_build_object('sub', new_uid::text, 'email', clean_email),
    'email', now(), now(), now()
  );

  update public.profiles
  set organization_id = target_org,
      role            = target_role,
      full_name       = trim(p_full_name),
      area_id         = target_area
  where id = new_uid;

  return new_uid;
end;
$function$;

revoke all on function public.create_org_member(text, text, text, text, uuid, uuid) from public, anon;
grant execute on function public.create_org_member(text, text, text, text, uuid, uuid) to authenticated;

-- La firma vieja de cinco argumentos queda huérfana: si se deja, PostgREST
-- puede resolver a ella y el área nunca se guardaría.
drop function if exists public.create_org_member(text, text, text, text, uuid);

-- ============================================================================
-- 7. Un jefe de área también ejerce
-- ============================================================================
--
-- `admin` es gerencia y no atiende pacientes; `admin_area` es el jefe de un
-- SERVICIO MÉDICO y sí — el del servicio de urgencias del Hospital General es
-- urgentólogo y pasa consulta. Obligarlo a llevar dos cuentas, una para dictar
-- y otra para mandar, sería una limitación nuestra y no del oficio.
--
-- Grabar ya le estaba permitido en la base: la política "insert consultations"
-- solo exige medico_id = auth.uid(), sin mirar el rol; quien lo impedía era
-- canAccessPath en lib/auth/roles.ts. Lo que sí faltaba es que pudiera
-- completar o corregir su propio perfil clínico, porque estas dos reglas
-- comparaban contra 'medico' a secas. Sin ellas, un jefe de servicio se queda
-- sin poder fijarse la especialidad y por tanto sin sus plantillas.

alter policy "Clinicians can complete own onboarding" on public.profiles
  using ((select auth.uid()) = id and role in ('medico', 'admin_area'))
  with check ((select auth.uid()) = id and role in ('medico', 'admin_area'));

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

  if p_professional_type not in ('medico_general', 'medico_especialista', 'patologo') then
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
    and role in ('medico', 'admin_area');

  if not found then
    raise exception 'Only clinician profiles can complete this onboarding';
  end if;
end;
$function$;
