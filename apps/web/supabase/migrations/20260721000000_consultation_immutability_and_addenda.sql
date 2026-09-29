-- Inmutabilidad de notas firmadas + adendas append-only.
--
-- Una consulta 'aprobada' o 'exportada' es un documento clínico-legal: su
-- contenido no se puede modificar. Las correcciones van en adendas que
-- preservan la nota original, el autor y la fecha.

-- 1) Trigger de inmutabilidad -------------------------------------------------
-- Congela el contenido clínico y de contexto de una fila firmada. transcript
-- queda congelado a propósito: es la evidencia de la que se derivó la nota.
-- Única transición de estado permitida: 'aprobada' -> 'exportada'.
-- Compara VALORES (is distinct from), no columnas presentes: los updates del
-- cliente que reenvían el mismo contenido (p. ej. persist() al exportar)
-- pasan sin fricción. DELETE ya está bloqueado por RLS (no existe policy).

create or replace function private.enforce_consultation_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.estado in ('aprobada', 'exportada') then
    if new.estado is distinct from old.estado
       and not (old.estado = 'aprobada' and new.estado = 'exportada') then
      raise exception 'CONSULTATION_IMMUTABLE: transicion de estado no permitida (% -> %)',
        old.estado, new.estado;
    end if;

    if new.note is distinct from old.note
       or new.resumen is distinct from old.resumen
       or new.codigos is distinct from old.codigos
       or new.transcript is distinct from old.transcript
       or new.firma is distinct from old.firma
       or new.patient_id is distinct from old.patient_id
       or new.medico_id is distinct from old.medico_id
       or new.organization_id is distinct from old.organization_id
       or new.fecha is distinct from old.fecha
       or new.motivo is distinct from old.motivo
       or new.servicio is distinct from old.servicio
       or new.especialidad is distinct from old.especialidad
       or new.tipo is distinct from old.tipo
       or new.plantilla is distinct from old.plantilla
       or new.duracion_min is distinct from old.duracion_min then
      raise exception 'CONSULTATION_IMMUTABLE: la nota firmada no admite cambios; usa una adenda';
    end if;
  end if;
  return new;
end;
$$;

create trigger consultations_immutability
  before update on public.consultations
  for each row execute function private.enforce_consultation_immutability();

-- 2) Adendas ------------------------------------------------------------------
-- Append-only: solo select + insert (sin policies ni grants de update/delete).
-- Autor y fecha automáticos (defaults), nunca editables después.

create table public.consultation_addenda (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  organization_id uuid not null default private.current_org()
    references public.organizations(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id),
  author_name text not null check (char_length(trim(author_name)) >= 1),
  contenido text not null check (char_length(trim(contenido)) >= 1),
  created_at timestamptz not null default now()
);

alter table public.consultation_addenda enable row level security;
create index on public.consultation_addenda (consultation_id);
create index on public.consultation_addenda (organization_id);

grant select, insert on table public.consultation_addenda to authenticated;

-- Lectura org-scoped (mismo criterio que audit_events).
create policy "org reads addenda" on public.consultation_addenda
  for select to authenticated
  using (organization_id = (select private.current_org()));

-- Inserción: solo el propio autor, solo en su org, y solo sobre consultas ya
-- firmadas. El exists corre bajo el RLS de consultations del propio usuario:
-- solo puede adendar consultas que puede ver.
create policy "insert addenda on signed consultations" on public.consultation_addenda
  for insert to authenticated
  with check (
    organization_id = (select private.current_org())
    and author_id = (select auth.uid())
    and exists (
      select 1 from public.consultations c
      where c.id = consultation_id
        and c.estado in ('aprobada', 'exportada')
    )
  );
