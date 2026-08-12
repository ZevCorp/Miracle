-- ============================================================================
-- Cuentas de facturación por organización (decisión D14; completa la D1).
--
-- POR QUÉ
-- D1 fijó desde el inicio que "la mensualidad se cobra por organización":
-- B2C = organización `personal` de una persona; B2B = `institution` que paga
-- por acuerdo. Esta migración crea la pieza que faltaba: dónde vive el estado
-- comercial y quién decide el acceso a partir de él.
--
-- DISEÑO
-- - `billing_accounts` es 1:1 con organizations y guarda los campos CRUDOS de
--   Stripe (stripe_status, current_period_end…) más los propios de Miracle
--   (mode, trial_ends_at, comped_until). El nivel de acceso NUNCA se guarda:
--   se deriva en `private.org_has_access()` — una sola fuente de verdad, sin
--   estados duplicados que sincronizar. Stripe es un proveedor sincronizado,
--   no la autoridad.
-- - `authenticated` LEE su fila (la página de suscripción la muestra) pero no
--   la escribe: escriben el webhook (credencial confinada a lib/billing/admin.ts,
--   decisión D15) y funciones SECURITY DEFINER.
-- - `billing_events` registra cada evento de webhook por id de Stripe
--   (idempotencia + auditoría). La app no lo lee; cero grants.
-- - Prefijo `billing_`: el proyecto Supabase se comparte con Graph (graph_*).
--
-- FAIL-OPEN DELIBERADO
-- Una organización SIN fila de billing tiene acceso. Lo contrario convertiría
-- cualquier bug de billing en un bloqueo de documentación clínica. El trigger
-- de auto-creación y el backfill hacen ese caso casi imposible.
-- ============================================================================

-- 1) La cuenta de facturación --------------------------------------------------

create table public.billing_accounts (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  -- self_serve: B2C, paga por Stripe. institutional: B2B, paga por acuerdo
  -- (su corte es organizations.archived_at). comped: cortesía/pilotos.
  mode text not null default 'self_serve'
    check (mode in ('self_serve', 'institutional', 'comped')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  -- Estado crudo de la suscripción tal como lo reporta Stripe. NULL = nunca
  -- ha habido suscripción (el acceso entonces depende del trial).
  stripe_status text
    check (stripe_status in ('trialing', 'active', 'past_due', 'canceled',
                             'incomplete', 'incomplete_expired', 'unpaid', 'paused')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  -- Trial SIN tarjeta, gestionado por Miracle (no existe objeto en Stripe
  -- hasta que el médico se suscribe). Solo aplica mientras stripe_status es NULL.
  trial_ends_at timestamptz,
  -- Solo para mode='comped': NULL = cortesía indefinida.
  comped_until timestamptz,
  -- Última vez que Stripe nos habló de esta cuenta (reconciliación).
  last_stripe_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.billing_accounts is
  'Estado comercial por organización. El acceso se deriva con private.org_has_access(); nunca se guarda.';

alter table public.billing_accounts enable row level security;

revoke all on public.billing_accounts from anon, authenticated;
grant select on public.billing_accounts to authenticated;

create policy "members read own billing" on public.billing_accounts
  for select to authenticated
  using (
    organization_id = (select private.current_org())
    or (select private.is_superadmin())
  );

create trigger on_billing_accounts_updated
  before update on public.billing_accounts
  for each row execute function private.set_updated_at();

-- 2) El registro de eventos de Stripe ------------------------------------------

create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  -- Idempotencia: un evento de Stripe se aplica una sola vez.
  stripe_event_id text not null unique,
  type text not null,
  organization_id uuid references public.organizations(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index billing_events_org_idx on public.billing_events (organization_id);

alter table public.billing_events enable row level security;
revoke all on public.billing_events from anon, authenticated;
-- Sin políticas: solo la credencial del webhook escribe y lee.

-- 3) Parámetros de negocio en un solo lugar ------------------------------------
-- Cambiar el trial o la gracia = editar una línea aquí, sin tocar código.

create or replace function private.billing_trial_days()
returns integer
language sql
immutable
set search_path = ''
as $$ select 14 $$;

-- 0 por decisión de producto: un pago fallido bloquea de inmediato (el médico
-- ve el letrero de pago y lo arregla desde el portal). Subir la gracia a N días
-- es cambiar este número.
create or replace function private.billing_grace_days()
returns integer
language sql
immutable
set search_path = ''
as $$ select 0 $$;

revoke all on function private.billing_trial_days() from public, anon, authenticated;
revoke all on function private.billing_grace_days() from public, anon, authenticated;

-- 4) LA función de acceso ------------------------------------------------------
-- Espejada en lib/billing/entitlements.ts (mismos casos, mismos resultados;
-- los tests de vitest cubren la matriz). Si cambias algo aquí, cámbialo allá.

create or replace function private.org_has_access(p_org uuid default null)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_archived timestamptz;
  b record;
begin
  -- El superadmin nunca queda fuera: es quien restaura, reconcilia y exporta
  -- la historia de un moroso si la ley lo exige.
  if (select private.is_superadmin()) then
    return true;
  end if;

  v_org := coalesce(p_org, (select private.current_org()));
  if v_org is null then
    return false;
  end if;

  select o.archived_at into v_archived
  from public.organizations o
  where o.id = v_org;

  if not found then
    return false;
  end if;

  -- Corte institucional existente (D11). De paso cierra el hueco de que un
  -- miembro de una org archivada aún podía escribir por PostgREST con su JWT
  -- vigente (≤1 h): ahora la base también lo niega.
  if v_archived is not null then
    return false;
  end if;

  select * into b from public.billing_accounts where organization_id = v_org;

  -- Fail-open documentado (ver encabezado).
  if not found then
    return true;
  end if;

  if b.mode = 'institutional' then
    return true;
  end if;

  -- La cortesía es un overlay: si venció, la cuenta se evalúa como self_serve
  -- (así un comped vencido que se suscribe por Stripe queda activo sin más).
  if b.mode = 'comped' and (b.comped_until is null or b.comped_until > now()) then
    return true;
  end if;

  -- self_serve:
  if b.stripe_status in ('active', 'trialing') then
    return true;
  end if;

  if b.stripe_status = 'past_due' then
    return now() < coalesce(b.current_period_end, now())
                   + make_interval(days => private.billing_grace_days());
  end if;

  -- Nunca hubo suscripción: manda el trial de Miracle.
  if b.stripe_status is null then
    return coalesce(b.trial_ends_at > now(), false);
  end if;

  -- canceled / unpaid / paused / incomplete / incomplete_expired.
  return false;
end;
$$;

-- OJO: `authenticated` NECESITA EXECUTE. Una política RLS se evalúa con los
-- permisos de QUIEN consulta, así que sin este grant toda consulta a las tablas
-- con el gate muere con "permission denied for function org_has_access" en vez
-- de filtrar filas. Es el mismo grant que ya tienen current_org(),
-- current_app_role(), is_admin() e is_superadmin(), que se usan igual dentro de
-- políticas. `anon` sigue sin nada, y el schema private no se expone por
-- PostgREST: nadie puede llamarla como endpoint.
revoke all on function private.org_has_access(uuid) from public, anon;
grant execute on function private.org_has_access(uuid) to authenticated;

-- Envoltorio para el guard de las APIs (PostgREST no expone el schema private).
create or replace function public.current_org_has_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.org_has_access() $$;

revoke all on function public.current_org_has_access() from public, anon;
grant execute on function public.current_org_has_access() to authenticated;

-- 5) Toda organización nace con su cuenta --------------------------------------
-- Cubre el alta B2C (handle_new_user), la consola del superadmin y cualquier
-- vía futura, sin tocar ninguna de esas funciones.

create or replace function private.ensure_billing_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.billing_accounts (organization_id, mode, trial_ends_at)
  values (
    new.id,
    case when new.kind::text = 'institution' then 'institutional' else 'self_serve' end,
    case when new.kind::text = 'institution' then null
         else now() + make_interval(days => private.billing_trial_days()) end
  )
  on conflict (organization_id) do nothing;
  return new;
end;
$$;

revoke all on function private.ensure_billing_account() from public, anon, authenticated;

create trigger ensure_billing_account
  after insert on public.organizations
  for each row execute function private.ensure_billing_account();

-- 6) Backfill de las organizaciones existentes ---------------------------------
-- institutions → institutional. La org personal del superadmin → comped (es de
-- plataforma). El resto de personales (hoy: una) → self_serve con trial de 14
-- días desde hoy. Para regalar cortesía a un cliente temprano:
--   update billing_accounts set mode='comped', comped_until=null
--    where organization_id = '<org>';

insert into public.billing_accounts (organization_id, mode, trial_ends_at)
select
  o.id,
  case
    when o.kind::text = 'institution' then 'institutional'
    when exists (
      select 1 from public.profiles p
      where p.organization_id = o.id and p.role::text = 'superadmin'
    ) then 'comped'
    else 'self_serve'
  end,
  case
    when o.kind::text = 'institution' then null
    when exists (
      select 1 from public.profiles p
      where p.organization_id = o.id and p.role::text = 'superadmin'
    ) then null
    else now() + make_interval(days => private.billing_trial_days())
  end
from public.organizations o
on conflict (organization_id) do nothing;

notify pgrst, 'reload schema';
