-- Por qué: el médico que trabaja con textos fijos (diagnósticos frecuentes,
-- planes, recomendaciones) hoy los tiene en archivos de Word o en un cuaderno y
-- los copia y pega en cada nota. Esta tabla guarda esos "atajos" personales de
-- texto plano, que se insertan en cualquier sección de la nota desde un botón o
-- escribiendo "/" (ver components/app/SnippetPopup.tsx).
--
-- Estrictamente privados: sin visibilidad de organización ni forma de
-- compartirlos entre cuentas — es una decisión de producto, no una limitación
-- técnica. El frontend los lee y escribe directo con el cliente Supabase del
-- navegador (patrón user_template_preferences / appointments); el backend Graph
-- no conoce esta tabla y no debe conocerla: no interviene en la generación de
-- la nota, solo en lo que el médico inserta a mano.
--
-- El contenido es TEXTO PLANO. La nota clínica lo es de punta a punta (editor,
-- note_json del backend, exportación a PDF), así que un atajo con formato
-- enriquecido no tendría dónde renderizarse. Se conservan saltos de línea y
-- viñetas escritas como texto ("- ").
--
-- El tope por usuario (1000) se valida en la aplicación (SNIPPET_LIMITS en
-- lib/clinical/snippets.ts) y no aquí: la única vía que puede acercarse a él es
-- la importación masiva, que es código propio, y un trigger de cuota costaría
-- un count por cada inserción de esa misma importación.

create table if not exists public.user_snippets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (btrim(title) <> '' and char_length(title) <= 120),
  content text not null check (btrim(content) <> '' and char_length(content) <= 20000),
  -- Categoría libre. En la práctica es el nombre de una sección de la nota
  -- ("Diagnóstico", "Plan de manejo"): el popup ordena primero los atajos cuya
  -- categoría coincide con la sección donde está escribiendo el médico.
  category text not null default '' check (char_length(category) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_snippets is
  'Atajos de texto personales del médico (frases rápidas insertables en la nota). Estrictamente privados: cada usuario solo ve y gestiona los suyos.';

-- La lista siempre se lee del usuario y ordenada por recencia.
create index if not exists user_snippets_user_updated_idx
  on public.user_snippets (user_id, updated_at desc);

drop trigger if exists on_user_snippets_updated on public.user_snippets;
create trigger on_user_snippets_updated
  before update on public.user_snippets
  for each row execute function private.set_updated_at();

alter table public.user_snippets enable row level security;

revoke all on table public.user_snippets from anon;
grant select, insert, update, delete on table public.user_snippets to authenticated;

drop policy if exists "read own snippets" on public.user_snippets;
create policy "read own snippets" on public.user_snippets
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "insert own snippets" on public.user_snippets;
create policy "insert own snippets" on public.user_snippets
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "update own snippets" on public.user_snippets;
create policy "update own snippets" on public.user_snippets
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "delete own snippets" on public.user_snippets;
create policy "delete own snippets" on public.user_snippets
  for delete to authenticated
  using (user_id = (select auth.uid()));

notify pgrst, 'reload schema';
