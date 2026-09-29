-- Por qué: la plantilla "Sugerida" institucional (is_default) es una sola por
-- especialidad y la fija la plataforma. Cada médico necesita poder fijar la
-- SUYA: la que quiere ver preseleccionada al iniciar una consulta. Esta tabla
-- guarda ese pin personal (1 por especialidad y por usuario); el frontend la
-- lee/escribe directo con el cliente Supabase del navegador (patrón
-- appointments), sin pasar por el backend Graph.
-- La preferencia gana sobre la última usada y sobre la sugerida institucional
-- en la preselección (lib/clinical/template-preferences.ts).

create table if not exists public.user_template_preferences (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  specialty_code text not null,
  template_id uuid not null references public.clinical_templates (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (user_id, specialty_code)
);

comment on table public.user_template_preferences is
  'Plantilla sugerida personal del médico (pin), una por especialidad. Estrictamente privada: cada usuario solo ve y gestiona las suyas.';

create index if not exists user_template_preferences_template_idx
  on public.user_template_preferences (template_id);

alter table public.user_template_preferences enable row level security;

grant select, insert, update, delete on table public.user_template_preferences to authenticated;

-- Preferencia estrictamente personal: sin visibilidad de organización.
drop policy if exists "read own template preferences" on public.user_template_preferences;
create policy "read own template preferences" on public.user_template_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "insert own template preferences" on public.user_template_preferences;
create policy "insert own template preferences" on public.user_template_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "update own template preferences" on public.user_template_preferences;
create policy "update own template preferences" on public.user_template_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "delete own template preferences" on public.user_template_preferences;
create policy "delete own template preferences" on public.user_template_preferences
  for delete to authenticated
  using (user_id = (select auth.uid()));
