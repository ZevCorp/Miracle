#!/usr/bin/env python3
"""nueva_migracion — crea el archivo de una migración de Supabase con una versión que no choca con
ninguna (ni en main ni en las ramas vivas) y con la plantilla del proyecto.

    python3 .claude/skills/migracion/scripts/nueva_migracion.py <graph|web> "<qué hace, en español>" [--spec NNN] [--seco]

  graph → services/graph/supabase/migrations/   (Graph: tablas que solo toca el service role)
  web   → apps/web/supabase/migrations/          (el portal: RLS por organización y rol)

La versión es YYYYMMDDHHMMSS en UTC. Si ya hay una igual o mayor (otra migración de hoy, en esta
rama o en otra), se toma la siguiente libre subiendo de 100 en 100 segundos, como hace el repo
(…000000, …000100, …000200). --seco imprime lo que haría sin escribir.

Por qué existe: el portal tiene dos migraciones con la versión 20260808140000, y la CLI de
Supabase identifica cada migración por su versión: una de las dos no se aplica.
"""
import datetime
import os
import re
import subprocess
import sys
import unicodedata

CARPETAS = {"graph": "services/graph/supabase/migrations", "web": "apps/web/supabase/migrations"}
RE_VERSION = re.compile(r"(?:^|/)(\d{14})_[^/]+\.sql$")

PLANTILLA_GRAPH = """-- ============================================================================
-- {titulo}{spec_linea}
--
-- POR QUÉ: <qué se midió o qué falla hoy, con números y fecha>.
--
-- QUIÉN LA LEE Y ESCRIBE: solo Graph, con el service role (que se salta RLS).
-- Por eso RLS va activada y SIN políticas, y anon/authenticated no ven nada.
--
-- APLICADA: todavía no. (Al aplicarla en miracle-app: «YA APLICADA en miracle-app
-- el AAAA-MM-DD», y lo que se midió ese día.)
-- ============================================================================

-- create table if not exists public.<tabla> (
--   id bigint generated always as identity primary key,
--   email text not null,
--   created_at timestamptz not null default now()
-- );
-- alter table public.<tabla> enable row level security;
-- revoke all on table public.<tabla> from anon, authenticated;

-- Una función, si hace falta:
-- create or replace function public.<funcion>(<args>)
-- returns <tipo>
-- language sql
-- security definer
-- set search_path = ''
-- as $$
--   select … from public.<tabla> …   -- nombres siempre calificados: el search_path está vacío
-- $$;
-- revoke all on function public.<funcion>(<args>) from public, anon, authenticated;
-- grant execute on function public.<funcion>(<args>) to service_role;
"""

PLANTILLA_WEB = """-- {titulo}{spec_linea}
--
-- ============================================================================
-- EL PROBLEMA
-- ============================================================================
--
-- <qué pasa hoy, a quién, con números. Qué rompe si no se hace.>
--
-- ============================================================================
-- LA DECISIÓN
-- ============================================================================
--
-- <qué se cambia y por qué así, y qué NO se hace.>
--
-- El código se despliega ANTES que esta migración: lo que lea una columna nueva
-- tiene que tolerar que todavía no exista (consulta aparte, y reportError si falla).

-- ============================================================================
-- 1. <la pieza>
-- ============================================================================

-- create table if not exists public.<tabla> (
--   id uuid primary key default gen_random_uuid(),
--   organization_id uuid not null references public.organizations(id) on delete cascade,
--   created_by uuid not null default auth.uid() references auth.users(id),
--   created_at timestamptz not null default now()
-- );
-- alter table public.<tabla> enable row level security;
-- grant select, insert, update, delete on public.<tabla> to authenticated;

-- drop policy if exists "org reads <tabla>" on public.<tabla>;
-- create policy "org reads <tabla>" on public.<tabla>
--   for select to authenticated
--   using (organization_id = (select private.current_org()));

-- Una función, si hace falta (en el esquema private si no es para PostgREST):
-- create or replace function private.<funcion>(<args>)
-- returns <tipo>
-- language plpgsql
-- security definer
-- set search_path = ''
-- as $$ begin … end $$;
-- revoke all on function private.<funcion>(<args>) from public, anon;
-- grant execute on function private.<funcion>(<args>) to authenticated;
"""


def git(*args):
    r = subprocess.run(["git", "-c", "core.quotepath=false", *args], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    return r.stdout if r.returncode == 0 else ""


def a_slug(texto):
    t = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode().lower()
    t = re.sub(r"[^a-z0-9]+", "_", t).strip("_")
    return t[:60].rstrip("_")


def versiones_en_todas_las_ramas(carpeta):
    refs = [r for r in git("for-each-ref", "--format=%(refname:short)", "refs/remotes", "refs/heads").split()
            if not r.endswith("/HEAD")]
    vistas = {}
    for ref in ["HEAD"] + refs:
        for nombre in git("ls-tree", "-r", "--name-only", ref, "--", carpeta).splitlines():
            m = RE_VERSION.search(nombre)
            if m:
                vistas.setdefault(m.group(1), set()).add((nombre.rsplit("/", 1)[-1], ref))
    # Y lo que hay en disco sin commitear.
    if os.path.isdir(carpeta):
        for nombre in os.listdir(carpeta):
            m = RE_VERSION.search(nombre)
            if m:
                vistas.setdefault(m.group(1), set()).add((nombre, "disco"))
    return vistas


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    spec = None
    if "--spec" in sys.argv:
        spec = sys.argv[sys.argv.index("--spec") + 1]
        args = [a for a in args if a != spec]
    if len(args) < 2 or args[0] not in CARPETAS:
        print(__doc__)
        sys.exit(2)
    proyecto, descripcion = args[0], " ".join(args[1:])
    raiz = git("rev-parse", "--show-toplevel").strip() or "."
    os.chdir(raiz)
    carpeta = CARPETAS[proyecto]

    vistas = versiones_en_todas_las_ramas(carpeta)
    repetidas = {v: sorted({n for n, _ in s}) for v, s in vistas.items() if len({n for n, _ in s}) > 1}
    ahora = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d%H%M%S")
    tope = max(vistas) if vistas else "0"
    version = ahora
    if version <= tope:
        dt = datetime.datetime.strptime(tope, "%Y%m%d%H%M%S") + datetime.timedelta(seconds=100)
        version = dt.strftime("%Y%m%d%H%M%S")
    slug = a_slug(descripcion)
    nombre = f"{version}_{slug}.sql"
    ruta = f"{carpeta}/{nombre}"
    spec_linea = f" (spec {spec})" if spec else ""
    plantilla = PLANTILLA_GRAPH if proyecto == "graph" else PLANTILLA_WEB
    contenido = plantilla.format(titulo=descripcion[:1].upper() + descripcion[1:], spec_linea=spec_linea)

    print(f"· la versión más alta en cualquier rama: {tope}")
    if version != ahora:
        print(f"· ahora (UTC) es {ahora}, que no es mayor: se toma {version}")
    for v, nombres in sorted(repetidas.items()):
        print(f"✘ versión repetida {v}: {' y '.join(nombres)} — una de las dos no se aplica")
    if "--seco" in sys.argv:
        print(f"(seco) crearía {ruta}")
        return
    if os.path.exists(ruta):
        print(f"NO SE CREÓ: ya existe {ruta}")
        sys.exit(1)
    os.makedirs(carpeta, exist_ok=True)
    with open(ruta, "w", encoding="utf-8", newline="\n") as f:
        f.write(contenido)
    print(f"✔ {ruta}")
    print("  Rellena la cabecera (el porqué con números) y descomenta lo que uses. Después:")
    print("  python3 .claude/skills/revisa/scripts/higiene.py   → tabla-sin-rls, definer-sin-search-path, migracion-vieja-editada")


if __name__ == "__main__":
    main()
