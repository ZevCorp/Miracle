-- ============================================================================
-- Corrige `sync_org_owner` (20260808140000): al mover al fundador de
-- organización, la de origen se quedaba con un `owner_id` colgado.
--
-- EL FALLO
-- El trigger solo miraba `new.organization_id`. Si un superadmin movía al
-- fundador de A hacia B, la organización A conservaba `owner_id` apuntando a
-- alguien que ya no es miembro suyo. Y como el puesto no quedaba vacante, la
-- rama `v_owner is null` no volvía a dispararse nunca: A se quedaba con un
-- fundador fantasma —sin protección real, porque `protect_org_owner` compara
-- contra `old.organization_id`, que para esa persona ya es B— y sin forma de
-- que otro admin de A ocupara el puesto.
--
-- LA CORRECCIÓN
-- Se sustituye la lógica por una reconciliación idempotente que se puede aplicar
-- a cualquier organización: conserva al dueño si sigue siendo un admin activo
-- suyo, y si no, entrega el puesto al admin activo más antiguo (o lo deja
-- vacante si no queda ninguno). El trigger la ejecuta sobre la organización de
-- destino y —cuando el perfil cambia de organización— también sobre la de
-- origen.
-- ============================================================================

create or replace function private.reconciliar_owner(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_org is null then
    return;
  end if;

  update public.organizations o
     set owner_id = coalesce(
       -- Sigue siendo válido: no se toca. Esto es lo que hace la función
       -- idempotente y evita relevos espurios en cada guardado de perfil.
       (select p.id from public.profiles p
         where p.id = o.owner_id
           and p.organization_id = p_org
           and p.role::text = 'admin'
           and p.disabled_at is null),
       -- Vacante: al admin activo más antiguo que quede.
       (select p.id from public.profiles p
         where p.organization_id = p_org
           and p.role::text = 'admin'
           and p.disabled_at is null
         order by p.created_at, p.id
         limit 1)
     )
   where o.id = p_org
     and o.owner_id is distinct from coalesce(
       (select p.id from public.profiles p
         where p.id = o.owner_id
           and p.organization_id = p_org
           and p.role::text = 'admin'
           and p.disabled_at is null),
       (select p.id from public.profiles p
         where p.organization_id = p_org
           and p.role::text = 'admin'
           and p.disabled_at is null
         order by p.created_at, p.id
         limit 1)
     );
end;
$$;

revoke all on function private.reconciliar_owner(uuid) from public, anon, authenticated;

create or replace function private.sync_org_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Al cambiar de organización hay DOS que reconciliar: la que se abandona
  -- —para que no se quede con un fundador que ya no es suyo— y la de destino.
  if tg_op = 'UPDATE' and old.organization_id is distinct from new.organization_id then
    perform private.reconciliar_owner(old.organization_id);
  end if;

  perform private.reconciliar_owner(new.organization_id);
  return new;
end;
$$;

revoke all on function private.sync_org_owner() from public, anon, authenticated;

drop trigger if exists sync_org_owner on public.profiles;
create trigger sync_org_owner
  after insert or update of role, disabled_at, organization_id on public.profiles
  for each row execute function private.sync_org_owner();

-- Pasada de saneamiento por si ya quedó alguna colgada.
do $$
declare v_org uuid;
begin
  for v_org in select id from public.organizations loop
    perform private.reconciliar_owner(v_org);
  end loop;
end;
$$;
