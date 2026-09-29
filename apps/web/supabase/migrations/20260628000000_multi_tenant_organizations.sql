-- ============================================================================
-- Modelo multi-tenant por ORGANIZACIÓN para Miracle.
--   · B2C (médico independiente) -> organización "personal" de una persona.
--   · B2B (hospital)             -> organización "institution" con varios.
-- Todos los datos clínicos cuelgan de la organización; RLS aísla por organización.
-- (Nota: el rol vive como TEXT en public.profiles, y el helper de admin es
--  private.is_admin(); por eso aquí no se usa el enum app_role.)
-- ============================================================================

create type public.org_kind as enum ('personal', 'institution');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.org_kind not null default 'personal',
  nit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.organizations enable row level security;

alter table public.profiles add column organization_id uuid references public.organizations(id);

-- Helpers (security definer para evitar recursión RLS sobre profiles).
create function private.current_org()
returns uuid language sql stable security definer set search_path = '' as $$
  select organization_id from public.profiles where id = (select auth.uid())
$$;
revoke all on function private.current_org() from public;
grant execute on function private.current_org() to authenticated;

create function private.current_app_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid())
$$;
revoke all on function private.current_app_role() from public;
grant execute on function private.current_app_role() to authenticated;

-- Registro: cada nuevo usuario obtiene su propia organización personal y es
-- admin de ella (B2C). Para B2B luego se invitan miembros a una org existente.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  new_org uuid;
  display_name text;
begin
  display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(new.email, 'medico'), '@', 1)
  );
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

-- Backfill: las cuentas existentes (de prueba) se agrupan en un hospital demo.
do $$
declare demo_org uuid;
begin
  insert into public.organizations (name, kind, nit)
  values ('Hospital Demo Miracle', 'institution', '900.000.000-0')
  returning id into demo_org;
  update public.profiles set organization_id = demo_org where organization_id is null;
end $$;
alter table public.profiles alter column organization_id set not null;

-- Organizaciones: miembros leen la suya; el admin la edita.
grant select, update on table public.organizations to authenticated;
create policy "members read own org" on public.organizations
  for select to authenticated using (id = (select private.current_org()));
create policy "admin updates own org" on public.organizations
  for update to authenticated
  using (id = (select private.current_org()) and private.is_admin())
  with check (id = (select private.current_org()));

-- Perfiles: el admin ahora ve/edita SOLO los de su organización.
drop policy if exists "profiles_select_self" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_select_self" on public.profiles
  for select to authenticated
  using ((id = (select auth.uid())) or (private.is_admin() and organization_id = (select private.current_org())));
create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (private.is_admin() and organization_id = (select private.current_org()))
  with check (organization_id = (select private.current_org()));

-- Pacientes (privados del médico; admin/supervisor ven los de la org).
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org() references public.organizations(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id),
  nombre text not null check (char_length(trim(nombre)) >= 1),
  documento text,
  edad int check (edad is null or (edad >= 0 and edad <= 130)),
  sexo text check (sexo is null or sexo in ('F', 'M')),
  eps text, telefono text,
  antecedentes text[] not null default '{}',
  alergias text[] not null default '{}',
  medicamentos text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.patients enable row level security;
create index on public.patients (organization_id);
grant select, insert, update, delete on table public.patients to authenticated;
create policy "read patients" on public.patients for select to authenticated
  using (organization_id = (select private.current_org())
    and ((select private.current_app_role()) in ('admin', 'supervisor') or created_by = (select auth.uid())));
create policy "insert patients" on public.patients for insert to authenticated
  with check (organization_id = (select private.current_org()) and created_by = (select auth.uid()));
create policy "update patients" on public.patients for update to authenticated
  using (organization_id = (select private.current_org())
    and ((select private.current_app_role()) in ('admin', 'supervisor') or created_by = (select auth.uid())));

-- Consultas (nota/códigos/transcripción como JSONB). El médico ve las suyas;
-- supervisor y admin ven todas las de su organización.
create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org() references public.organizations(id) on delete cascade,
  medico_id uuid not null default auth.uid() references auth.users(id),
  patient_id uuid references public.patients(id) on delete set null,
  servicio text, especialidad text,
  tipo text not null default 'presencial',
  estado text not null default 'borrador',
  motivo text,
  fecha timestamptz not null default now(),
  duracion_min int, plantilla text, resumen text,
  note jsonb not null default '[]'::jsonb,
  codigos jsonb not null default '[]'::jsonb,
  transcript jsonb not null default '[]'::jsonb,
  firma jsonb,
  created_at timestamptz not null default now()
);
alter table public.consultations enable row level security;
create index on public.consultations (organization_id);
create index on public.consultations (patient_id);
grant select, insert, update, delete on table public.consultations to authenticated;
create policy "read consultations" on public.consultations for select to authenticated
  using (organization_id = (select private.current_org())
    and ((select private.current_app_role()) in ('admin', 'supervisor') or medico_id = (select auth.uid())));
create policy "insert consultations" on public.consultations for insert to authenticated
  with check (organization_id = (select private.current_org()) and medico_id = (select auth.uid()));
create policy "update consultations" on public.consultations for update to authenticated
  using (organization_id = (select private.current_org())
    and ((select private.current_app_role()) in ('admin', 'supervisor') or medico_id = (select auth.uid())));

-- Auditoría (append-only).
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org() references public.organizations(id) on delete cascade,
  consultation_id uuid references public.consultations(id) on delete cascade,
  actor_id uuid default auth.uid(),
  actor_name text, accion text not null, detalle text,
  fecha timestamptz not null default now()
);
alter table public.audit_events enable row level security;
create index on public.audit_events (consultation_id);
grant select, insert on table public.audit_events to authenticated;
create policy "org reads audit" on public.audit_events for select to authenticated
  using (organization_id = (select private.current_org()));
create policy "org inserts audit" on public.audit_events for insert to authenticated
  with check (organization_id = (select private.current_org()));
