-- Preferencia de redacción de la nota generada.
--
-- Distinta a assistant_detail: una cosa es cómo te RESPONDE el asistente y otra
-- cómo REDACTA la historia clínica. Solo afecta a las secciones interpretativas
-- de la nota (conversación médico-paciente); las literales (patología,
-- radiología, laboratorio…) se copian tal cual se dictaron, diga lo que diga
-- esta columna. 'estandar' reproduce el comportamiento anterior.
--
-- Idempotente y con el MISMO vocabulario que ya está aplicado en producción
-- (concisa | estandar | detallada): en producción es un no-op.

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
end
$$;

comment on column public.user_preferences.note_detail is
  'Extensión de las secciones interpretativas de la nota generada: concisa, estandar o detallada. No afecta a las secciones literales.';
