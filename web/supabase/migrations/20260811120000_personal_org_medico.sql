-- ============================================================================
-- La organización personal nace con rol `medico` (decisión D16).
--
-- EL PROBLEMA
-- El alta B2C (registro propio / Google) creaba la org personal con rol
-- `admin`… pero el producto que se le vende al médico exige rol `medico`:
-- /app/consultas/nueva y /en-vivo (canAccessPath), el onboarding clínico
-- (la RPC complete_clinical_onboarding y su política RLS exigen `medico`).
-- Resultado: quien se registraba solo, no podía usar Miracle Notes.
--
-- LA REGLA
-- En una organización personal el único miembro ES el médico. `medico` le da
-- el producto completo; lo administrativo que le falte (suscripción) se le da
-- por ser org personal, no por rol. De paso se cierra un hueco comercial: un
-- "admin personal" podía invitar N médicos vía create_org_member y pagar una
-- sola suscripción; un `medico` no puede invitar a nadie.
--
-- CONSECUENCIA ASUMIDA
-- Las orgs personales quedan con owner_id NULL (sync_org_owner solo corona
-- admins). Correcto: la protección del fundador existe para que sus PARES no
-- lo degraden, y en una org de una persona no hay pares.
--
-- CARVE-OUT `auth.uid() is null`
-- Los triggers protectores del fundador bloqueaban también a la conexión
-- administrativa (migraciones, SQL editor), donde is_superadmin() es false por
-- no haber sesión. Se les añade el mismo carve-out que ya usa
-- prevent_demo_flag_escalation: sin sesión = mantenimiento consciente de la
-- plataforma, no un usuario escalando.
-- ============================================================================

-- 1) handle_new_user: la rama personal asigna `medico` -------------------------
-- Redefinición partiendo de la versión VIVA (que incluye la guarda de usuarios
-- de Graph, ausente en migraciones antiguas de este repo — no partir de ellas).

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  new_org      uuid;
  display_name text;
  meta_org     uuid;
  meta_role    text;
begin
  -- Usuarios de Graph (asistente Android): sin perfil clínico ni organización.
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
  if meta_role not in ('admin', 'supervisor', 'medico') then
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

  -- Alta B2C: organización personal + MÉDICO (antes 'admin'; ver encabezado).
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
$$;

-- 2) Carve-out de conexión administrativa en los triggers protectores ----------

create or replace function private.protect_org_owner()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  -- Conexión administrativa (migraciones, SQL editor): mantenimiento de
  -- plataforma, no un usuario. Mismo patrón que prevent_demo_flag_escalation.
  if (select auth.uid()) is null then
    return new;
  end if;

  if not exists (
    select 1 from public.organizations o
    where o.id = old.organization_id and o.owner_id = old.id
  ) then
    return new;
  end if;

  if (select private.is_superadmin()) then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'El administrador principal de la organización solo cambia de rol desde la consola de plataforma.'
      using errcode = '42501';
  end if;

  if new.disabled_at is not null and old.disabled_at is null then
    raise exception 'El administrador principal de la organización no se puede desactivar desde el hospital.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function private.protect_org_owner_column()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.owner_id is not distinct from old.owner_id then
    return new;
  end if;
  if (select auth.uid()) is null then
    return new;
  end if;
  if (select private.is_superadmin()) then
    return new;
  end if;

  if old.owner_id is not null and exists (
    select 1 from public.profiles p
    where p.id = old.owner_id
      and p.organization_id = new.id
      and p.role::text = 'admin'
      and p.disabled_at is null
  ) then
    raise exception 'El administrador principal solo se releva desde la consola de plataforma.'
      using errcode = '42501';
  end if;

  if new.owner_id is not null and not exists (
    select 1 from public.profiles p
    where p.id = new.owner_id
      and p.organization_id = new.id
      and p.role::text = 'admin'
      and p.disabled_at is null
  ) then
    raise exception 'El administrador principal debe ser un administrador activo de la organización.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function private.prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if old.role::text = 'admin'
     and new.role::text <> 'admin'
     and (select auth.uid()) is not null
     and not (select private.is_superadmin())
     -- Un cambio de contexto (switch_active_organization) no es una
     -- degradación: la membresía conserva su puesto de admin para volver.
     and coalesce(current_setting('miracle.org_switch', true), '') <> '1'
     and not exists (
       select 1 from public.profiles p
       where p.organization_id = old.organization_id
         and p.role::text = 'admin'
         and p.disabled_at is null
         and p.id <> old.id
     ) then
    raise exception 'La organización quedaría sin ningún administrador.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 3) Backfill: los admins de orgs personales pasan a médico --------------------
-- Hoy: exactamente una cuenta real. Su org queda con owner_id NULL vía
-- sync_org_owner (esperado). onboarding_completed_at sigue NULL → pasará por
-- el onboarding clínico en su próximo login (deseado: hoy no tiene perfil
-- clínico ni especialidad).

update public.profiles p
set role = 'medico'
from public.organizations o
where o.id = p.organization_id
  and o.kind::text = 'personal'
  and p.role::text = 'admin';

notify pgrst, 'reload schema';
