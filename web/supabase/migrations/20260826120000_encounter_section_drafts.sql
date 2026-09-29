-- Lo que el médico ESCRIBE por sección mientras la consulta va corriendo.
--
-- POR QUÉ: en una consulta real hay cosas que el médico quiere en la nota y no
-- dice en voz alta —una sospecha, una decisión, un plan que aún está pensando—.
-- Hasta ahora eso no tenía dónde vivir: si no se decía, no existía para la nota.
--
-- POR QUÉ POR SECCIÓN: la plantilla ya es el contrato entre la app y el motor de
-- notas. Colgar el texto de la MISMA sección a la que pertenece quita la
-- ambigüedad sobre dónde debe aterrizar, y funciona con cualquier plantilla
-- porque se apoya en las `key` del snapshot congelado del encounter, no en una
-- lista fija de nombres. Ver lib/clinical/section-drafts.ts y D20.
--
-- POR QUÉ UNA TABLA DE ESTA APP Y NO UNA COLUMNA EN clinical_encounters:
-- `clinical_encounters` es del backend clínico, que vive en otro repositorio, y
-- la regla de este repo es que el frontend NUNCA la toca directo. Esta tabla es
-- del navegador, como `user_snippets`, `appointments` o
-- `user_template_preferences`: el médico escribe, el navegador guarda.
--
-- ESTO NO ES LA NOTA NI LA HISTORIA CLÍNICA. Es el borrador de trabajo del
-- médico durante la consulta. Lo que queda como documento clínico es la nota
-- generada, que sí pasa por revisión y firma.
--
-- ESTRICTAMENTE PRIVADO: solo el médico que lo escribió lo ve. No hay
-- visibilidad de organización ni forma de compartirlo, igual que los atajos.

create table if not exists public.encounter_section_drafts (
  -- Mismo id que el encounter del backend clínico. No lleva clave foránea a
  -- `clinical_encounters` a propósito: esa tabla es de otro servicio y su
  -- ciclo de vida no lo manda esta app. El borrado se cubre por `doctor_id`.
  encounter_id uuid not null,
  -- `key` de la sección dentro del template_snapshot congelado del encounter.
  section_key text not null check (btrim(section_key) <> '' and char_length(section_key) <= 80),
  content text not null check (char_length(content) <= 20000),
  doctor_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Una anotación por sección y por consulta: el autoguardado escribe con
  -- upsert sobre esta clave, así que reescribir nunca duplica filas.
  primary key (encounter_id, section_key)
);

comment on table public.encounter_section_drafts is
  'Texto que el médico escribe por sección durante la consulta, antes de generar la nota. Borrador privado de trabajo, no historia clínica. Se suma a la transcripción al generar (ver lib/clinical/section-drafts.ts).';

-- La pantalla siempre pide TODAS las anotaciones de una consulta a la vez.
create index if not exists encounter_section_drafts_encounter_idx
  on public.encounter_section_drafts (doctor_id, encounter_id);

drop trigger if exists on_encounter_section_drafts_updated on public.encounter_section_drafts;
create trigger on_encounter_section_drafts_updated
  before update on public.encounter_section_drafts
  for each row execute function private.set_updated_at();

alter table public.encounter_section_drafts enable row level security;

revoke all on table public.encounter_section_drafts from anon;
grant select, insert, update, delete on table public.encounter_section_drafts to authenticated;

drop policy if exists "read own section drafts" on public.encounter_section_drafts;
create policy "read own section drafts" on public.encounter_section_drafts
  for select to authenticated
  using (doctor_id = (select auth.uid()));

drop policy if exists "insert own section drafts" on public.encounter_section_drafts;
create policy "insert own section drafts" on public.encounter_section_drafts
  for insert to authenticated
  with check (doctor_id = (select auth.uid()));

drop policy if exists "update own section drafts" on public.encounter_section_drafts;
create policy "update own section drafts" on public.encounter_section_drafts
  for update to authenticated
  using (doctor_id = (select auth.uid()))
  with check (doctor_id = (select auth.uid()));

drop policy if exists "delete own section drafts" on public.encounter_section_drafts;
create policy "delete own section drafts" on public.encounter_section_drafts
  for delete to authenticated
  using (doctor_id = (select auth.uid()));
