-- Extensión con la que el médico quiere que se le redacte la nota clínica
-- (Configuración > General: concisa | estandar | detallada).
--
-- Vive en user_preferences (personal y portátil entre computadores) y NO en la
-- plantilla: es un gusto del médico, no una propiedad del molde. Viaja al
-- backend en el cuerpo de generate-note como { doctor: { note_detail } } y en
-- Graph se convierte en un bloque del system prompt. 'estandar' no viaja ni
-- emite nada, así que quien no toque esta casilla sigue recibiendo la nota de
-- siempre.
--
-- Distinta de assistant_detail: aquella gradúa cuánto se extiende el ASISTENTE
-- al responder; esta gradúa la NOTA generada. Comparten forma, no significado.
--
-- No aplica a las especialidades de informe literal (patología, radiología,
-- laboratorio...): allí el prompt copia el dictado palabra por palabra y el
-- backend ignora esta preferencia a propósito.
--
-- Sin grants ni políticas nuevas: el grant de tabla y la RLS por fila de
-- 20260829120000_user_preferences.sql ya cubren la columna.

alter table public.user_preferences
  add column if not exists note_detail text not null default 'estandar';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_preferences_note_detail_check'
  ) then
    alter table public.user_preferences
      add constraint user_preferences_note_detail_check
      check (note_detail in ('concisa', 'estandar', 'detallada'));
  end if;
end $$;

comment on column public.user_preferences.note_detail is
  'Extensión de la nota generada: concisa | estandar | detallada. Solo cambia la redacción; nunca los datos.';

comment on table public.user_preferences is
  'Preferencias personales del médico (plantilla de arranque, servicio, extensión de la nota, asistente). Estrictamente privada: cada usuario solo ve y gestiona la suya.';
