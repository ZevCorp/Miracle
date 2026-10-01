---
name: migracion
description: Crea y aplica una migración de Supabase para Graph o para el portal (Miracle Notes) sin chocar versiones, con RLS cerrada por defecto, funciones security definer seguras, el código tolerante a que la columna aún no exista, y la aplicación en producción confirmada y medida. Úsala cuando haya que crear o cambiar una tabla, columna, índice, política, función o RPC, cuando el usuario diga "migración", "agrega una columna", "nueva tabla", "cambia el esquema", "RLS", "policy", o cuando un cambio de código necesite datos que la base aún no tiene.
---

# Una migración

Lo que ya costó: tablas abiertas a `anon` por el valor por defecto de Supabase (tres arreglos en
Graph), dos migraciones con la misma versión en el portal (`20260808140000`: una no se aplica),
código desplegado antes que su columna, y migraciones aplicadas a mano sin dejar constancia.

## 1. El archivo

```bash
python3 .claude/skills/migracion/scripts/nueva_migracion.py <graph|web> "<qué hace, en español>" [--spec NNN]
```

Elige una versión `YYYYMMDDHHMMSS` (UTC) mayor que cualquiera en `main`, en las ramas vivas y en el
disco, y escribe la plantilla del proyecto. `--seco` para ver el nombre sin crear nada.

**Una migración nueva nunca edita una vieja**: la vieja ya está aplicada y el cambio no llegaría.

## 2. El contenido, según el proyecto

| | Graph (`services/graph`) | Portal (`apps/web`) |
|---|---|---|
| Quién accede | solo Graph, con el service role | el navegador, como `authenticated`, bajo RLS |
| RLS | `enable row level security` **sin políticas** + `revoke all … from anon, authenticated` | `enable row level security` + `grant … to authenticated` + políticas |
| Políticas | ninguna | `using (organization_id = (select private.current_org()))`; roles con `private.is_admin()`, `private.is_superadmin()`, `private.supervises(…)`. El `(select …)` hace que Postgres lo evalúe una vez, no por fila |
| Funciones | `security definer set search_path = ''`, nombres calificados, `revoke … from public, anon, authenticated`, `grant execute … to service_role` | igual, en el esquema `private` si no son para PostgREST; `grant execute … to authenticated` |
| Datos que no van por la API | esquema `archivo` (ver `20261001000200_archivo_graph_windows_logs.sql`) | — |
| Estilo | cabecera `-- ====` con el porqué medido y la spec | idempotente (`if not exists`, `drop policy if exists`), cabecera «EL PROBLEMA / LA DECISIÓN» |

La cabecera explica el **porqué con números** (cuántas filas, cuántos MB, qué consulta), no el qué:
el qué ya es el SQL.

## 3. El código que la usa

- **El código se despliega antes que la migración** (Graph y el portal se despliegan solos al
  mergear). Lo que lee una columna nueva la consulta aparte y tolera que no exista: en el portal,
  `reportError` y seguir; nunca tumbar la pantalla.
- **Portal:** no hay tipos generados; tipa la fila a mano. En un embed de PostgREST nombra la FK
  (`organizations!profiles_organization_id_fkey(name)`): sin ella, con dos FKs, sale PGRST201 y un
  `null` silencioso.
- **Graph:** los repositorios (`src/infrastructure/repositories/Supabase*Repository.js`) llevan su
  `SELECT_COLUMNS` y su `mapRow`. Si la consulta usa un filtro que `scripts/lib/fakeSupabase.js` no
  entiende, el doble lanza: añádele el filtro (en esta misma rama) en vez de esquivarlo.

## 4. Revisarla

```bash
python3 .claude/skills/revisa/scripts/higiene.py
```

Mira `tabla-sin-rls`, `definer-sin-search-path`, `migracion-vieja-editada` y versiones repetidas.

## 5. Aplicarla — con el usuario

Aplicar es tocar producción: **pide confirmación** con el SQL delante, salvo que el usuario ya lo
haya pedido. Con el MCP de Supabase:

1. Ubica el proyecto (`list_projects`): Graph usa `miracle-app`; el portal, el suyo (está en
   `apps/web/.mcp.json`). Si hay duda, pregunta.
2. **Antes:** mide lo que la cabecera promete (`execute_sql` de solo lectura: filas, tamaño).
3. `apply_migration` con el **mismo nombre** del archivo (sin `.sql`), para que el historial de
   Supabase y el repo coincidan.
4. **Después:** `get_advisors` (seguridad y rendimiento) y la misma medida de antes.
5. Escribe en la cabecera «YA APLICADA en <proyecto> el <fecha>» y lo medido, y marca la casilla
   del Cierre de la spec.

Sin MCP o sin permiso: deja la migración escrita y di exactamente qué falta aplicar y dónde.
