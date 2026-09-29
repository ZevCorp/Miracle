-- Preferencias personales del médico (una fila por usuario).
--
-- Por qué una tabla nueva y no columnas en `profiles`: las políticas de UPDATE
-- de profiles son un campo minado —la de auto-edición exige `role = 'medico'` y
-- la otra es de admin sobre TODA su organización—, así que colgar de ahí un
-- ajuste personal significaría o abrir una política nueva sobre la tabla de
-- identidad, o dejar sin ajustes a los supervisores. Esta tabla es
-- estrictamente privada y copia el patrón ya probado de
-- user_template_preferences: `default auth.uid()` + RLS `user_id = auth.uid()`
-- en las cuatro operaciones, escrita directo desde el navegador.
--
-- Lo que NO vive aquí, a propósito:
--   * el tema claro/oscuro  -> localStorage. El script pre-paint del <head> lo
--     lee de forma síncrona; traerlo de la base metería un parpadeo en cada
--     carga a cambio de nada, porque ya persiste entre sesiones.
--   * el micrófono preferido -> localStorage. Un deviceId no significa nada en
--     otro computador; guardarlo aquí sería guardar un dato falso.
--   * la plantilla fija     -> user_template_preferences, que ya existe. Aquí
--     solo se guarda el MODO; la plantilla sigue siendo el pin de siempre.

create table if not exists public.user_preferences (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,

  -- Qué plantilla queda preseleccionada al iniciar una consulta.
  --   last   = la última que usó de verdad (localStorage del navegador)
  --   fixed  = su pin de user_template_preferences
  --   manual = ninguna; la elige cada vez
  template_start_mode text not null default 'last'
    check (template_start_mode in ('last', 'fixed', 'manual')),

  -- Servicio con el que nacen sus consultas. La institución define la LISTA
  -- (organizations.servicios); el médico elige cuál es el suyo. Si el admin
  -- quita ese servicio de la lista, se cae al institucional: no se inventa.
  default_servicio text,

  -- Cómo le habla el asistente. Cada una parametriza una regla que el system
  -- prompt de Graph YA tiene; no son ejes nuevos.
  assistant_address text not null default 'usted'
    check (assistant_address in ('tu', 'usted')),
  assistant_detail text not null default 'equilibrado'
    check (assistant_detail in ('breve', 'equilibrado', 'detallado')),
  assistant_use_name boolean not null default true,

  updated_at timestamptz not null default now()
);

comment on table public.user_preferences is
  'Preferencias personales del médico (plantilla de arranque, servicio, asistente). Estrictamente privada: cada usuario solo ve y gestiona la suya.';

alter table public.user_preferences enable row level security;

grant select, insert, update, delete on table public.user_preferences to authenticated;

drop policy if exists "read own preferences" on public.user_preferences;
create policy "read own preferences" on public.user_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "insert own preferences" on public.user_preferences;
create policy "insert own preferences" on public.user_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "update own preferences" on public.user_preferences;
create policy "update own preferences" on public.user_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "delete own preferences" on public.user_preferences;
create policy "delete own preferences" on public.user_preferences
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Backfill: hasta hoy el pin personal GANABA siempre en la preselección. Si
-- todos nacieran en 'last', a quien ya fijó su sugerida le cambiaríamos el
-- comportamiento por debajo sin avisarle. Quien tiene pin nace en 'fixed'.
insert into public.user_preferences (user_id, template_start_mode)
select distinct user_id, 'fixed'
from public.user_template_preferences
on conflict (user_id) do nothing;
