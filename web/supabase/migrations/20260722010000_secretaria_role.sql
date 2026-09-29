-- Rol "secretaria": cuenta de solo lectura acotada a médicos específicos.
--
-- Por qué NO se reutiliza 'supervisor': ese rol ya tiene acceso de lectura a
-- TODA la organización (todos los médicos, /app/auditoria, /app/reportes) vía
-- las políticas RLS existentes. Acotarlo a un subconjunto de médicos exigiría
-- excepciones que complicarían ese rol para otros hospitales. Un rol nuevo,
-- acotado por una tabla de permisos explícita (secretary_doctor_access), es
-- más limpio y no toca el comportamiento de 'supervisor' en ningún lado.
--
-- Pedido: una secretaria/enfermera del Hospital General de Medellín necesita
-- revisar las consultas de 2 patólogos concretos y descargar/copiar sus notas,
-- sin poder grabar ni editar nada.

-- 1) Ampliar el CHECK de profiles.role (mismo patrón que se usó para
--    professional_type al agregar 'patologo').
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role = any (array['admin', 'supervisor', 'medico', 'superadmin', 'secretaria']));

-- 2) Tabla de permisos: qué médicos puede ver cada secretaria. Sin políticas
--    de insert/update/delete a propósito: los accesos se administran por
--    migración/SQL directo (no hay UI de administración todavía); la única
--    política es que la propia secretaria pueda leer SUS asignaciones (para
--    poblar el selector de médico en /app/consultas).
create table public.secretary_doctor_access (
  secretary_id uuid not null references public.profiles(id) on delete cascade,
  medico_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (secretary_id, medico_id)
);
alter table public.secretary_doctor_access enable row level security;
grant select on table public.secretary_doctor_access to authenticated;
create policy "secretary reads own access" on public.secretary_doctor_access
  for select to authenticated
  using (secretary_id = (select auth.uid()));

-- 3) Ampliar la lectura de consultations: una secretaria ve las consultas de
--    los médicos que tenga asignados (y solo esos), dentro de su misma
--    organización (la condición organization_id ya está en la política).
alter policy "read consultations" on public.consultations
  using (deleted_at is null
    and organization_id = (select private.current_org())
    and (
      (select private.current_app_role()) in ('admin', 'supervisor')
      or medico_id = (select auth.uid())
      or (
        (select private.current_app_role()) = 'secretaria'
        and exists (
          select 1 from public.secretary_doctor_access sda
          where sda.secretary_id = (select auth.uid())
            and sda.medico_id = consultations.medico_id
        )
      )
    ));

-- 4) Misma rama en patients, comparando contra created_by (quien registró al
--    paciente) — necesario para que el nombre del paciente se vea en el
--    detalle de la consulta.
alter policy "read patients" on public.patients
  using (organization_id = (select private.current_org())
    and (
      (select private.current_app_role()) in ('admin', 'supervisor')
      or created_by = (select auth.uid())
      or (
        (select private.current_app_role()) = 'secretaria'
        and exists (
          select 1 from public.secretary_doctor_access sda
          where sda.secretary_id = (select auth.uid())
            and sda.medico_id = patients.created_by
        )
      )
    ));
