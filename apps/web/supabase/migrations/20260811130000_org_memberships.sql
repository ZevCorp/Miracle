-- ============================================================================
-- Membresías de organización (decisión D17): una persona, varios mundos.
--
-- EL REQUISITO
-- Un médico puede pagar su Miracle Notes personal (B2C) y además trabajar en
-- un hospital que también contrata Miracle (B2B). Una sola identidad
-- (auth.users) debe poder pertenecer a ambas organizaciones.
--
-- EL DISEÑO MENOS DESTRUCTIVO
-- `profiles.organization_id` sigue siendo la organización ACTIVA — toda la RLS
-- (private.current_org()) queda intacta. `org_memberships` registra a qué
-- organizaciones pertenece la persona y con qué rol. Un trigger la sincroniza
-- desde profiles, así que create_org_member, superadmin_move_user y
-- handle_new_user no cambian. Cambiar de contexto = la RPC
-- switch_active_organization (valida membresía y actualiza la org activa).
-- Sin interfaz de switcher todavía: hoy nadie tiene dos membresías.
--
-- LA VULNERABILIDAD QUE SE CIERRA DE PASO
-- La política "Clinicians can complete own onboarding" permite a un médico
-- hacer UPDATE de su propia fila de profiles SIN restringir columnas: con
-- PostgREST podía auto-cambiarse organization_id a cualquier UUID y leer otro
-- tenant. El trigger prevent_foreign_org_change lo bloquea desde hoy.
-- ============================================================================

-- 1) La tabla ------------------------------------------------------------------

create table public.org_memberships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Rol DENTRO de esa organización (el de plataforma, superadmin, no es
  -- membresía: es de Miracle, no de una org).
  role text not null check (role in ('admin', 'supervisor', 'medico', 'secretaria')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);

comment on table public.org_memberships is
  'A qué organizaciones pertenece cada persona. profiles.organization_id es la ACTIVA; esto es el conjunto.';

create index org_memberships_org_idx on public.org_memberships (organization_id);

alter table public.org_memberships enable row level security;

revoke all on public.org_memberships from anon, authenticated;
grant select on public.org_memberships to authenticated;
-- Escritura: solo triggers y RPCs SECURITY DEFINER.

create policy "members read own memberships" on public.org_memberships
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "admin reads org memberships" on public.org_memberships
  for select to authenticated
  using (
    (select private.is_admin())
    and organization_id = (select private.current_org())
  );

create policy "superadmin reads memberships" on public.org_memberships
  for select to authenticated
  using ((select private.is_superadmin()));

create trigger on_org_memberships_updated
  before update on public.org_memberships
  for each row execute function private.set_updated_at();

-- 2) Sincronización desde profiles ---------------------------------------------
-- Cubre TODAS las vías de alta y movida existentes sin tocarlas. La semántica
-- actual de "mover de organización" (superadmin_move_user) se conserva: al
-- mover, la membresía vieja se elimina. Solo un cambio de contexto legítimo
-- (la RPC de abajo, que marca el GUC) conserva ambas.

create or replace function private.sync_org_membership()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  -- El superadmin es de plataforma: no se registra como miembro de una org.
  if new.role::text = 'superadmin' then
    return new;
  end if;

  insert into public.org_memberships (user_id, organization_id, role)
  values (new.id, new.organization_id, new.role::text)
  on conflict (user_id, organization_id)
  do update set role = excluded.role, status = 'active', updated_at = now();

  if tg_op = 'UPDATE'
     and old.organization_id is distinct from new.organization_id
     and coalesce(current_setting('miracle.org_switch', true), '') <> '1' then
    delete from public.org_memberships
    where user_id = new.id and organization_id = old.organization_id;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_org_membership() from public, anon, authenticated;

create trigger sync_org_membership
  after insert or update of organization_id, role on public.profiles
  for each row execute function private.sync_org_membership();

-- 3) Nadie se muda de organización por su cuenta -------------------------------

create or replace function private.prevent_foreign_org_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.organization_id is distinct from old.organization_id
     and (select auth.uid()) is not null
     and not (select private.is_superadmin())
     and coalesce(current_setting('miracle.org_switch', true), '') <> '1' then
    raise exception 'La organización de una cuenta solo se cambia desde la consola de plataforma.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_foreign_org_change() from public, anon, authenticated;

create trigger prevent_foreign_org_change
  before update of organization_id on public.profiles
  for each row execute function private.prevent_foreign_org_change();

-- 4) Cambiar de contexto -------------------------------------------------------
-- Dormida hasta que exista el switcher en la interfaz; la dejamos lista y
-- probada para que la coexistencia B2C+B2B no exija otra migración.

create or replace function public.switch_active_organization(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid;
  v_role text;
  v_current uuid;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Authentication is required';
  end if;

  select m.role into v_role
  from public.org_memberships m
  where m.user_id = v_uid
    and m.organization_id = p_organization_id
    and m.status = 'active';

  if v_role is null then
    raise exception 'No perteneces a esa organización.' using errcode = '42501';
  end if;

  select organization_id into v_current from public.profiles where id = v_uid;
  if v_current = p_organization_id then
    return;
  end if;

  -- El fundador de una organización no abandona el contexto sin relevo: su rol
  -- en profiles es lo que protect_org_owner/sync_org_owner protegen, y un
  -- switch lo dejaría de admin a medico con el puesto colgando.
  if exists (
    select 1 from public.organizations o
    where o.id = v_current and o.owner_id = v_uid
  ) then
    raise exception 'El administrador principal debe ser relevado antes de cambiar de contexto.'
      using errcode = '42501';
  end if;

  perform set_config('miracle.org_switch', '1', true);

  update public.profiles
  set organization_id = p_organization_id,
      role = v_role
  where id = v_uid;
end;
$$;

revoke all on function public.switch_active_organization(uuid) from public, anon;
grant execute on function public.switch_active_organization(uuid) to authenticated;

-- 5) Backfill ------------------------------------------------------------------
-- Cada perfil existente (salvo el superadmin de plataforma) es miembro de su
-- organización actual con su rol actual.

insert into public.org_memberships (user_id, organization_id, role)
select p.id, p.organization_id, p.role::text
from public.profiles p
where p.role::text <> 'superadmin'
on conflict (user_id, organization_id) do nothing;

notify pgrst, 'reload schema';
