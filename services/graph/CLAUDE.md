@AGENTS.md

## graphify

El mapa del código de este proyecto vive en `graphify-out/` (no se versiona). Se crea con
`tools/graphify/instalar` desde la raíz del repo y se rehace solo tras cada commit, cambio de rama y
pull. Cuándo usarlo está en las reglas comunes (`AGENTS.md` de la raíz, §Herramientas):

- **A quién afecta tu rama:** `bash tools/graphify/impacto.sh`.
- **Quién depende de una pieza:** `graphify affected "Nombre"`, desde esta carpeta.
- **Pregunta amplia:** `graphify query "…"` una vez, y después se lee el código.
- **Con un nombre exacto, búsqueda directa.** Consultar el mapa antes de cada búsqueda se midió el
  2026-10-01 y no ahorraba nada.
