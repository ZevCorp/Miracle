-- ============================================================================
-- El administrador principal de una organización no se toca desde el hospital.
--
-- EL HUECO
-- `prevent_role_escalation` (20260714000000) solo vigila el rol de plataforma:
-- su propio comentario dice "los cambios entre medico/supervisor/admin siguen
-- permitidos". Y la política `profiles_update_admin` deja a cualquier admin
-- escribir sobre cualquier perfil de su organización mientras el rol resultante
-- no sea 'superadmin'. Resultado: en un hospital con dos administradores,
-- cualquiera puede degradar al otro a médico y quedarse solo con la institución.
-- La UI no lo ofrece, pero PostgREST es alcanzable con la sesión normal, así que
-- la UI no es la defensa.
--
-- LA REGLA
-- Cada organización tiene un administrador fundador (`organizations.owner_id`).
-- Ese perfil solo cambia de rol —o se desactiva— desde la consola de plataforma.
-- El resto de administradores se siguen gestionando entre sí como hasta ahora.
--
-- EL ATAJO QUE HABÍA QUE CERRAR
-- `admin updates own org` no restringe columnas, así que un admin podía
-- apuntarse `owner_id` a sí mismo y degradar después al fundador de verdad.
--
-- Y UNA TERCERA COSA QUE ESTABA ROTA
-- `prevent_last_admin_removal` existe en 20260630000000 pero NO está instalado
-- en la base viva, pese a que app/app/usuarios/actions.ts afirma en un
-- comentario que la base lo bloquea. Además contaba los admins de TODA la
-- plataforma en vez de los de la organización, así que con cinco clientes no
-- habría saltado jamás. Se corrige a conteo por organización y se instala.
-- ============================================================================

-- 1) Quién es el fundador ------------------------------------------------------
alter table public.organizations
  add column if not exists owner_id uuid references public.profiles(id) on delete set null;

comment on column public.organizations.owner_id is
  'Administrador principal. Solo un superadmin cambia su rol o lo releva.';

-- Relleno para lo que ya existe: el admin activo más antiguo de cada
-- organización. Es la mejor aproximación disponible —no hay registro de quién la
-- creó— y para las organizaciones personales (un solo miembro) es exacta por
-- construcción. Una organización sin admins se queda sin dueño: no hay a quién
-- proteger.
update public.organizations o
set owner_id = elegido.id
from (
  select distinct on (p.organization_id) p.organization_id, p.id
  from public.profiles p
  where p.role::text = 'admin' and p.disabled_at is null
  order by p.organization_id, p.created_at, p.id
) elegido
where elegido.organization_id = o.id and o.owner_id is null;

-- 2) `owner_id` solo lo mueve un superadmin… salvo para corregirse -------------
--
-- Sin excepción, esto bloquearía dos cosas legítimas: que una organización nueva
-- estrene dueño (paso 3, que corre con la sesión del que se registra) y que el
-- puesto se libere cuando el fundador deja de ser admin. Por eso lo permitido
-- sin ser superadmin es exactamente una CORRECCIÓN: el dueño saliente ya no es
-- un admin activo, y el entrante sí lo es.
--
-- No es una puerta: para llegar a "el fundador ya no es admin activo" hay que
-- degradarlo o desactivarlo, y las dos cosas las bloquea el paso 4.
create or replace function private.protect_org_owner_column()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is not distinct from old.owner_id then
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

revoke all on function private.protect_org_owner_column() from public, anon, authenticated;

drop trigger if exists protect_org_owner_column on public.organizations;
create trigger protect_org_owner_column
  before update on public.organizations
  for each row execute function private.protect_org_owner_column();

-- 3) Mantener el puesto coherente ----------------------------------------------
-- Dos trabajos: estrenar dueño en una organización que no lo tiene (el alta B2C
-- y la consola crean organización y primer admin sin pasar por aquí, y sin esto
-- nacerían desprotegidas), y LIBERAR el puesto cuando el fundador deja de ser
-- admin activo. Lo segundo importa tanto como lo primero: si un superadmin
-- degrada al fundador y `owner_id` se queda apuntándole, el paso 4 pasaría a
-- proteger a alguien que ya es médico —y nadie podría volver a tocarle el rol.
create or replace function private.sync_org_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_activo boolean;
begin
  select o.owner_id into v_owner
  from public.organizations o where o.id = new.organization_id;

  v_activo := new.role::text = 'admin' and new.disabled_at is null;

  if v_owner is null and v_activo then
    update public.organizations set owner_id = new.id where id = new.organization_id;
  elsif v_owner = new.id and not v_activo then
    -- El relevo va al siguiente admin activo más antiguo; si no queda ninguno,
    -- el puesto queda vacante hasta que haya uno.
    update public.organizations set owner_id = (
      select p.id from public.profiles p
      where p.organization_id = new.organization_id
        and p.role::text = 'admin'
        and p.disabled_at is null
        and p.id <> new.id
      order by p.created_at, p.id
      limit 1
    ) where id = new.organization_id;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_org_owner() from public, anon, authenticated;

drop trigger if exists sync_org_owner on public.profiles;
create trigger sync_org_owner
  after insert or update of role, disabled_at, organization_id on public.profiles
  for each row execute function private.sync_org_owner();

-- 4) El fundador es intocable desde el hospital --------------------------------
create or replace function private.protect_org_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Solo mira al fundador; el resto del equipo sigue como estaba.
  if not exists (
    select 1 from public.organizations o
    where o.id = old.organization_id and o.owner_id = old.id
  ) then
    return new;
  end if;

  if (select private.is_superadmin()) then
    return new;
  end if;

  -- Se bloquea venga de quien venga, incluido el propio fundador: dejarle
  -- degradarse a sí mismo reabre la misma puerta por el otro lado —la
  -- organización se queda sin dueño y sin nadie que pueda recuperarlo—. El resto
  -- del perfil (nombre, especialidad, firma) se sigue editando con normalidad.
  if new.role is distinct from old.role then
    raise exception 'El administrador principal de la organización solo cambia de rol desde la consola de plataforma.'
      using errcode = '42501';
  end if;

  -- Desactivar es degradar por otra vía: lo deja sin acceso igual.
  if new.disabled_at is not null and old.disabled_at is null then
    raise exception 'El administrador principal de la organización no se puede desactivar desde el hospital.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_org_owner() from public, anon, authenticated;

drop trigger if exists protect_org_owner on public.profiles;
create trigger protect_org_owner
  before update on public.profiles
  for each row execute function private.protect_org_owner();

-- 5) Nunca dejar una organización sin administrador ----------------------------
-- Reescrito por ORGANIZACIÓN. La versión de 20260630000000 contaba
-- `from public.profiles where role='admin'` sin filtrar: en una base
-- multi-tenant eso pregunta "¿queda algún admin en toda la plataforma?", que con
-- cinco clientes es siempre que sí.
create or replace function private.prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role::text = 'admin'
     and new.role::text <> 'admin'
     and not (select private.is_superadmin())
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

revoke all on function private.prevent_last_admin_removal() from public, anon, authenticated;

drop trigger if exists prevent_last_admin_removal on public.profiles;
create trigger prevent_last_admin_removal
  before update on public.profiles
  for each row execute function private.prevent_last_admin_removal();
