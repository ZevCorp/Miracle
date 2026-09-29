-- ============================================================================
-- Super-admin de plataforma (Miracle) + alta de miembros en una organización.
--
--   · Añade el rol 'superadmin': es de Miracle, no de un hospital. Ve y gestiona
--     TODO (todas las organizaciones, todos los usuarios y lo clínico).
--   · handle_new_user(): si el alta trae organización + rol en app_metadata
--     (lo escribe SOLO el service-role vía Admin API), el perfil entra en ESA
--     organización con ese rol y NO se crea organización personal. Así "crear un
--     médico en un hospital" no deja organizaciones huérfanas.
--   · RLS aditiva: el superadmin puede leer/gestionar todas las tablas.
--
-- Seguridad: la organización/rol se leen de raw_app_meta_data (no de
-- raw_user_meta_data), porque app_metadata NO lo puede falsificar el usuario en
-- un registro público — solo el service-role. Evita escalada de privilegios.
--
-- Idempotente y defensivo: el esquema vivo divergió de las migraciones (role es
-- TEXT y el helper private.is_admin() solo existe en la base viva), así que aquí
-- no se asume el tipo de la columna ni el nombre del check.
-- ============================================================================

-- 1) Permitir el valor 'superadmin' en profiles.role -------------------------
do $$
declare
  v_type text;
  v_con  text;
begin
  select c.data_type into v_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'profiles'
    and c.column_name = 'role';

  if v_type = 'USER-DEFINED' then
    -- role sigue siendo el enum public.app_role: añadir el valor si falta.
    alter type public.app_role add value if not exists 'superadmin';
  else
    -- role es TEXT (esquema vivo): reemplazar cualquier CHECK sobre la columna
    -- role por uno que incluya 'superadmin'.
    for v_con in
      select con.conname
      from pg_constraint con
      where con.conrelid = 'public.profiles'::regclass
        and con.contype = 'c'
        and pg_get_constraintdef(con.oid) ~* '\yrole\y'
    loop
      execute format('alter table public.profiles drop constraint %I', v_con);
    end loop;
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('admin', 'supervisor', 'medico', 'superadmin'));
  end if;
end $$;

-- 2) Helper: ¿el usuario actual es superadmin? -------------------------------
--    role::text funciona tanto si la columna es TEXT como si es el enum.
create or replace function private.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role::text = 'superadmin'
       from public.profiles p
      where p.id = (select auth.uid())),
    false
  )
$$;
revoke all on function private.is_superadmin() from public;
grant execute on function private.is_superadmin() to authenticated;

-- 3) Alta de usuario: respetar organización + rol cuando vienen por app_metadata
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org      uuid;
  display_name text;
  meta_org     uuid;
  meta_role    text;
begin
  display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(new.email, 'medico'), '@', 1)
  );

  -- La organización y el rol llegan SOLO por app_metadata (service-role). El
  -- usuario no puede falsificar app_metadata en un signup público.
  begin
    meta_org := nullif(new.raw_app_meta_data ->> 'organization_id', '')::uuid;
  exception when others then
    meta_org := null;
  end;

  meta_role := coalesce(nullif(new.raw_app_meta_data ->> 'role', ''), 'medico');
  if meta_role not in ('admin', 'supervisor', 'medico') then
    meta_role := 'medico';  -- 'superadmin' jamás se asigna por esta vía
  end if;

  if meta_org is not null then
    -- Miembro de un hospital existente: sin organización personal.
    insert into public.profiles (id, email, full_name, avatar_url, role, organization_id)
    values (
      new.id, coalesce(new.email, ''),
      coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
      new.raw_user_meta_data ->> 'avatar_url',
      meta_role, meta_org
    )
    on conflict (id) do nothing;
    return new;
  end if;

  -- Comportamiento por defecto (B2C / Google): organización personal + admin.
  insert into public.organizations (name, kind)
  values ('Consultorio de ' || display_name, 'personal')
  returning id into new_org;

  insert into public.profiles (id, email, full_name, avatar_url, role, organization_id)
  values (
    new.id, coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url', 'admin', new_org
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- 3.1) Seguro: el guardián del "último admin" debe comparar en TEXT ----------
--      (la columna role es TEXT en vivo; una versión que castee al enum
--      app_role fallaría al hacer updates de rol). role::text funciona en ambos.
create or replace function private.prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role::text = 'admin'
     and new.role::text <> 'admin'
     and (select count(*) from public.profiles where role::text = 'admin') <= 1 then
    raise exception 'At least one admin account is required';
  end if;
  return new;
end;
$$;

-- 4) RLS aditiva para el superadmin -----------------------------------------
--    Políticas permisivas nuevas (se combinan con OR sobre las existentes):
--    no alteran el comportamiento actual, solo le dan visibilidad total al
--    superadmin. La consola usa el cliente servidor (con RLS) para leer.

-- Organizaciones: el superadmin lee, crea y edita cualquiera.
grant insert on table public.organizations to authenticated;

drop policy if exists "superadmin reads orgs" on public.organizations;
create policy "superadmin reads orgs" on public.organizations
  for select to authenticated using ((select private.is_superadmin()));

drop policy if exists "superadmin inserts orgs" on public.organizations;
create policy "superadmin inserts orgs" on public.organizations
  for insert to authenticated with check ((select private.is_superadmin()));

drop policy if exists "superadmin updates orgs" on public.organizations;
create policy "superadmin updates orgs" on public.organizations
  for update to authenticated
  using ((select private.is_superadmin()))
  with check ((select private.is_superadmin()));

-- Perfiles: el superadmin ve y mueve a cualquiera (entre organizaciones).
drop policy if exists "superadmin reads profiles" on public.profiles;
create policy "superadmin reads profiles" on public.profiles
  for select to authenticated using ((select private.is_superadmin()));

drop policy if exists "superadmin updates profiles" on public.profiles;
create policy "superadmin updates profiles" on public.profiles
  for update to authenticated
  using ((select private.is_superadmin()))
  with check ((select private.is_superadmin()));

-- Datos clínicos: lectura total (defensa en profundidad; la consola también
-- puede leer con el service-role).
drop policy if exists "superadmin reads patients" on public.patients;
create policy "superadmin reads patients" on public.patients
  for select to authenticated using ((select private.is_superadmin()));

drop policy if exists "superadmin reads consultations" on public.consultations;
create policy "superadmin reads consultations" on public.consultations
  for select to authenticated using ((select private.is_superadmin()));

drop policy if exists "superadmin reads audit" on public.audit_events;
create policy "superadmin reads audit" on public.audit_events
  for select to authenticated using ((select private.is_superadmin()));

-- ============================================================================
-- BOOTSTRAP del primer superadmin (correr a mano una vez, NO en esta migración):
--   1. Crea la cuenta (Supabase Studio → Authentication → Add user, o Admin API)
--      con email superadmin@miracle.app y una contraseña.
--   2. Promuévela:
--        update public.profiles set role = 'superadmin'
--        where email = 'superadmin@miracle.app';
-- ============================================================================
