-- ============================================================================
-- Agenda del médico: citas del día (appointments).
--   · Se crean a mano (hora + paciente) o importadas desde una foto del
--     horario del sistema hospitalario (extracción con IA en /api/parse-schedule).
--   · paciente_nombre es texto libre: la cita puede no corresponder aún a un
--     paciente registrado; al iniciar la consulta se resuelve o se crea.
-- Idempotente y defensivo: el esquema vivo puede divergir de las migraciones.
-- ============================================================================

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org() references public.organizations(id) on delete cascade,
  medico_id uuid not null default auth.uid() references auth.users(id),
  patient_id uuid references public.patients(id) on delete set null,
  paciente_nombre text not null check (char_length(trim(paciente_nombre)) >= 1),
  paciente_documento text,
  fecha date not null default (now() at time zone 'America/Bogota')::date,
  hora time not null,
  duracion_min int check (duracion_min is null or duracion_min between 1 and 600),
  motivo text,
  estado text not null default 'programada' check (estado in ('programada', 'atendida', 'cancelada')),
  source text not null default 'manual' check (source in ('manual', 'importada')),
  created_at timestamptz not null default now()
);

alter table public.appointments enable row level security;

create index if not exists appointments_org_fecha_idx on public.appointments (organization_id, fecha);
create index if not exists appointments_medico_fecha_idx on public.appointments (medico_id, fecha);
create index if not exists appointments_patient_idx on public.appointments (patient_id);

grant select, insert, update, delete on table public.appointments to authenticated;

-- El médico gestiona su propia agenda; supervisor/admin leen la de su organización.
drop policy if exists "read appointments" on public.appointments;
create policy "read appointments" on public.appointments for select to authenticated
  using (organization_id = (select private.current_org())
    and ((select private.current_app_role()) in ('admin', 'supervisor') or medico_id = (select auth.uid())));

drop policy if exists "insert appointments" on public.appointments;
create policy "insert appointments" on public.appointments for insert to authenticated
  with check (organization_id = (select private.current_org()) and medico_id = (select auth.uid()));

drop policy if exists "update appointments" on public.appointments;
create policy "update appointments" on public.appointments for update to authenticated
  using (organization_id = (select private.current_org()) and medico_id = (select auth.uid()))
  with check (organization_id = (select private.current_org()) and medico_id = (select auth.uid()));

drop policy if exists "delete appointments" on public.appointments;
create policy "delete appointments" on public.appointments for delete to authenticated
  using (organization_id = (select private.current_org()) and medico_id = (select auth.uid()));
