-- Preferencia de redacción de la nota generada.
--
-- Distinta a assistant_detail: una cosa es cómo te RESPONDE el asistente y otra
-- cómo REDACTA la historia clínica. Solo afecta a las secciones interpretativas
-- de la nota (conversación médico-paciente); las literales (patología,
-- radiología, laboratorio…) se copian tal cual se dictaron, diga lo que diga
-- esta columna. 'equilibrado' reproduce el comportamiento anterior.

alter table public.user_preferences
  add column if not exists note_detail text not null default 'equilibrado';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_preferences_note_detail_check'
  ) then
    alter table public.user_preferences
      add constraint user_preferences_note_detail_check
      check (note_detail in ('conciso', 'equilibrado', 'detallado'));
  end if;
end
$$;

comment on column public.user_preferences.note_detail is
  'Extensión de las secciones interpretativas de la nota generada: conciso, equilibrado o detallado. No afecta a las secciones literales.';
