# Claude en el monorepo

Las reglas comunes están en `.claude/rules/monorepo.md`, que es una copia de `AGENTS.md`, y se cargan
solas desde cualquier carpeta del repo.

Lo que es propio de Claude Code aquí (medido el 2026-09-28 con la versión 2.1.276):

- **Abre la sesión en la carpeta del proyecto** (`apps/windows`, `apps/web`…). Abierta así, Claude
  carga este archivo, las reglas de `.claude/rules/` de la raíz, el `CLAUDE.md` del proyecto y sus
  reglas. Abierta en la raíz, lo de un proyecto solo se carga cuando lees un archivo suyo, y sus
  hooks, su `settings.json` y su `.mcp.json` no se cargan nunca.
- **Un `@import` que sale de la carpeta donde abriste la sesión pide permiso**, y sin nadie que
  conteste (modo `-p`, agentes) no se carga. Por eso las reglas comunes son una copia y no un import.
- **`settings.local.json` es tuyo y no se versiona.** Ahí va lo que depende de tu máquina, como el
  hook de graphify (ver `docs/herramientas/`). Un `settings.json` versionado con la ruta de un
  ejecutable de un PC concreto falla en los demás sin avisar.
