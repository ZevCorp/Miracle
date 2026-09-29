-- Cierra una escalada de privilegios en public.profiles.
--
-- Problema: la política de UPDATE `profiles_update_admin`
-- (20260628000000_multi_tenant_organizations.sql:92-95) valida solo
-- `organization_id = current_org()` en el WITH CHECK; NO restringe el valor de
-- `role`. Como en B2C todo médico entra como `admin` de su propia organización
-- (handle_new_user), cualquier admin podía hacer
--   PATCH /rest/v1/profiles?id=eq.<su_id>  { "role": "superadmin" }
-- con su sesión normal y volverse superadmin de plataforma, lo que da SELECT
-- sobre patients/consultations/audit_events/profiles de TODAS las organizaciones
-- (fuga total de PHI entre clientes).
--
-- Defensa en dos capas, idempotente y compatible con el esquema vivo (role puede
-- ser TEXT o el enum app_role → se compara con ::text, igual que el resto de
-- migraciones):
--   1) Trigger BEFORE UPDATE que gobierna los cambios de `role`.
--   2) WITH CHECK endurecido en la política de UPDATE (cinturón y tirantes).

-- 1) Trigger: reglas de cambio de rol -----------------------------------------
create or replace function private.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  -- Otorgar o revocar 'superadmin' es exclusivo de un superadmin existente.
  -- Cierra la auto-promoción admin->superadmin (el vector de fuga de PHI entre
  -- organizaciones). Los cambios de rol dentro de la org entre
  -- medico/supervisor/admin siguen permitidos (los gobierna el RLS por org).
  if new.role is distinct from old.role
     and (new.role::text = 'superadmin' or old.role::text = 'superadmin')
     and not private.is_superadmin() then
    raise exception 'No autorizado para asignar o quitar el rol de plataforma (superadmin).'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_role_escalation() from public;

drop trigger if exists prevent_role_escalation on public.profiles;
create trigger prevent_role_escalation
  before update on public.profiles
  for each row execute function private.prevent_role_escalation();

-- 2) WITH CHECK endurecido en la política de UPDATE de perfiles ----------------
-- Reafirma la definición conocida (multi_tenant_organizations.sql:92-95) y le
-- agrega la guarda de rol: un no-superadmin nunca puede escribir role=superadmin.
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (private.is_admin() and organization_id = (select private.current_org()))
  with check (
    organization_id = (select private.current_org())
    and (role::text <> 'superadmin' or (select private.is_superadmin()))
  );

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN contra la base VIVA (correr manualmente en el SQL Editor de
-- Supabase; las migraciones en disco divergieron del esquema de producción):
--
--   -- (a) Confirmar que la escalada quedó bloqueada: como un admin normal,
--   --     este UPDATE debe fallar con 42501:
--   --     update public.profiles set role='superadmin' where id = auth.uid();
--
--   -- (b) Revisar TODAS las políticas de profiles y confirmar que NO existe
--   --     ninguna SELECT sin scope de organización (p. ej. una vieja
--   --     "Admins can read all profiles" que filtraría nombres/emails de otras
--   --     organizaciones):
--   select policyname, cmd, qual, with_check
--   from pg_policies
--   where schemaname = 'public' and tablename = 'profiles'
--   order by cmd, policyname;
--
--   -- Si aparece una política SELECT permisiva sin `organization_id = current_org()`
--   -- (distinta de la de superadmin), eliminarla:
--   --   drop policy if exists "Admins can read all profiles" on public.profiles;
-- -----------------------------------------------------------------------------
