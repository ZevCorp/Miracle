# Claude en el monorepo

Las reglas comunes están en `.claude/rules/monorepo.md`, que es una copia de `AGENTS.md`, y se cargan
solas desde cualquier carpeta del repo.

Lo que es propio de Claude Code aquí (medido el 2026-09-28 y el 2026-09-30, con la versión 2.1.276):

- **Antes de tu primera edición, entra a tu propio árbol.** Créalo con
  `bash tools/monorepo/arbol.sh nuevo <persona>/<que-hace>` y entra con la herramienta
  `EnterWorktree`, pasándole esa ruta en `path`. Varias sesiones se abren en la misma carpeta; si
  editas ahí, un gancho te detiene cuando el árbol ya es de otra sesión. Al terminar, con el PR
  mergeado: `bash tools/monorepo/arbol.sh cerrar`.
- **Abre la sesión en la carpeta del proyecto** (`apps/windows`, `services/graph`…). Abierta así,
  Claude carga este archivo, las reglas de `.claude/rules/` de la raíz, el `CLAUDE.md` del proyecto
  y sus reglas. Abierta en la raíz, lo de un proyecto solo se carga cuando lees un archivo suyo.
- **Las skills de la raíz llegan a todas las carpetas**: `/especifica`, `/fases`, `/promesas`,
  `/implementa`, `/verifica` y `/a-main` son las mismas en todos los proyectos.
- **Los ganchos, los permisos y `.mcp.json` no se heredan**: solo valen los de la carpeta donde se
  abre la sesión. Por eso el gancho del guardia de árboles está repetido en el `settings.json` de la
  raíz y en el de cada proyecto, y `tools/monorepo/comprobar-raiz.sh` comprueba que no falte en
  ninguno.
- **Un `@import` que sale de la carpeta donde abriste la sesión pide permiso**, y sin nadie que
  conteste (modo `-p`, agentes) no se carga. Por eso las reglas comunes son una copia y no un import.
- **`settings.local.json` es tuyo y no se versiona.** Ahí va lo que depende de tu máquina, como el
  hook de graphify (ver `docs/herramientas/`). Un `settings.json` versionado con la ruta de un
  ejecutable de un PC concreto falla en los demás sin avisar.
