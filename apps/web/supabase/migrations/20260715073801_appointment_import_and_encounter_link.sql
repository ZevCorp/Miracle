-- Agenda: una captura importada no duplica citas y cada cita puede enlazarse a
-- un encounter clínico externo sin imponer una clave foránea entre proyectos.
alter table public.appointments
  add column if not exists import_fingerprint text,
  add column if not exists clinical_encounter_id text,
  add column if not exists consultation_started_at timestamptz;

alter table public.appointments
  drop constraint if exists appointments_estado_check;

alter table public.appointments
  add constraint appointments_estado_check
  check (estado in ('programada', 'en_curso', 'atendida', 'cancelada'));

create unique index if not exists appointments_import_fingerprint_unique
  on public.appointments (medico_id, import_fingerprint)
  where import_fingerprint is not null;

create index if not exists appointments_clinical_encounter_idx
  on public.appointments (clinical_encounter_id)
  where clinical_encounter_id is not null;
