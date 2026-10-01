---
name: antes-del-push
description: Ensaya el push antes de hacerlo — corre el portero de cada proyecto que la rama toca sobre el commit que se empujaría, y además revisa lo que el portero no mira (rama mal nombrada, gancho sin activar, atraso con main, rama anterior al monorepo, archivos sin commitear, secretos en un repo público). Úsala antes de cualquier git push, cuando el portero salió en rojo y no se entiende por qué, o cuando el usuario diga "voy a empujar", "pásale el portero", "¿esto entra?", "el hook me bloquea", "ensaya el push".
---

# Antes del push

El portero decide en el push, pero tarda (Windows, ~2 min) y su rojo llega cuando ya tenías la
cabeza en otra cosa. El ensayo dice lo mismo antes, y añade lo que el portero no mira.

## 1. Correr el ensayo

Desde la raíz del monorepo (o dentro de tu árbol):

```bash
bash .claude/skills/antes-del-push/scripts/ensayo.sh
#   --sin-fetch     sin red
#   --sin-portero   solo las comprobaciones rápidas (segundos)
```

Le pasa al despachador `.githooks/pre-push` la misma línea que git le daría al empujar `HEAD`, así
que juzga **el commit**, no el árbol de trabajo: lo sin commitear no cuenta, y lo dice.

## 2. Lo que mira además del portero

| Comprobación | Por qué |
|---|---|
| no estás en `main` | `main` solo cambia por PR |
| la rama es `<persona>/<que-hace>` | las exenciones (`chore/`, `docs/`, `refactor/`, `hotfix/`) se leen del prefijo |
| `core.hooksPath` = `.githooks` | sin eso, el push de verdad no corre ningún portero y nadie se entera |
| cuánto vas detrás de `main` | un rebase después de verificar obliga a verificar otra vez |
| la rama nació antes del 2026-09-28 | sin `ponerse-al-dia.sh`, el diff contra `main` es enorme y el despachador llama a todos |
| porteros que esta máquina no puede correr | Windows necesita dotnet y PowerShell; Mac, macOS; Android, el SDK. Lo que no corre aquí lo juzga el CI |
| secretos en lo añadido | **el repo es público**: `.env`, `.jks`, `apikey.properties`, claves `sk-…`, `AIza…`, `ghp_…`, JWT, contraseñas. Imprime el tipo y el archivo, nunca el valor |

## 3. Si sale rojo

Di **qué comprobación** y con **qué salida literal**. Las causas de siempre:

- **«esta rama cambia código y no añade ninguna promesa»**: falta la promesa. Es `/promesas`, no
  un renombrado. Solo si de verdad no cambia comportamiento, la rama es `chore/` o `refactor/`
  (y en Android, además, no puede tocar código de producción).
- **Contrato roto o «NO SE PUDO JUZGAR»**: es `/juez-rojo`.
- **No compila en el árbol temporal pero sí en el tuyo**: tienes algo sin commitear (o sin
  `git add`) de lo que depende el código. Commitéalo.
- **Rama anterior al monorepo**: `git fetch origin && bash <(git show origin/main:tools/monorepo/ponerse-al-dia.sh)`.
- **Un secreto**: sácalo del commit antes de empujar (`git reset --soft origin/main` y recommitea
  sin él, o `git rm --cached`), muévelo a los secretos de GitHub Actions, a Vercel o a un `.env`
  ignorado. Si ya llegó a GitHub, darlo por publicado y rotarlo.

**Nunca `--no-verify`.** Si el portero se equivoca, la conversación es sobre su regla, con el
usuario, no sobre saltarse el gancho.

## 4. Si sale verde

El push lo hace el usuario, o tú si ya te lo pidió: `git push -u origin <rama>`. Y después,
`/a-main` para el PR.
