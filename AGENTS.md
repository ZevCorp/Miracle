# Ü — el monorepo

Todo Miracle en un solo repo: los clientes de Ü (Windows, Mac y Android), el cerebro (Graph) y el
portal clínico (Miracle Notes). Este archivo es el mapa y las reglas comunes. Las reglas de cada
proyecto viven en su carpeta.

## Dónde vive cada cosa

| Carpeta | Qué es | Stack | Su guía |
|---|---|---|---|
| `apps/windows/` | Ü para Windows, con SAP GUI | C# · .NET 8 · WPF | `apps/windows/AGENTS.md`, `CLAUDE.md` y su `.claude/rules/` |
| `apps/mac/` | Ü para Mac | Swift | `apps/mac/AGENTS.md` |
| `apps/android/` | Ü para Android | Kotlin · Gradle | `apps/android/AGENTS.md` |
| `apps/web/` | Miracle Notes, el portal clínico | Next.js · Supabase | `apps/web/AGENTS.md` |
| `services/graph/` | Graph, el cerebro: API, LLM, memoria, Provider Studio | Node · Python · Vercel | `services/graph/AGENTS.md` |
| `docs/` | lo del monorepo (`docs/monorepo/`) y las herramientas comunes (`docs/herramientas/`) | | |
| `tools/monorepo/` | scripts del repo | bash | |

`apps/` son las cosas que se instalan o se abren; `services/`, lo que corre en un servidor para
todas ellas. El porqué de cada decisión está en `docs/monorepo/arquitectura.md`.

## El método: la promesa antes que el código

**Ninguna línea de producción entra antes que la promesa que la juzga.** Vale en Windows, Android,
Mac y Graph; el detalle y el porqué están en `docs/monorepo/metodo.md`.

```
1.  tu árbol:     bash tools/monorepo/arbol.sh nuevo <persona>/<que-hace>
2.  la spec:      <proyecto>/docs/specs/NNN-<slug>.md, con sus promesas numeradas
3.  la promesa:   escrita en el contrato del proyecto, y vista en ROJO
4.  el código, hasta que salga verde
5.  ROMPE el código a propósito: si la promesa no se pone roja, no vale nada
6.  pruébalo de verdad: en el PC, en el teléfono, contra el servidor en marcha
7.  git push: el portero decide
8.  PR con la evidencia → la compuerta en verde → squash merge
9.  cierra:       bash tools/monorepo/arbol.sh cerrar
```

| Proyecto | Promesas | El juez (desde su carpeta) |
|---|---|---|
| `apps/windows` | `tests/ContratoDelGrafo/Contrato.cs` | `.\scripts\contrato-del-grafo.ps1` y `.\scripts\contrato-de-la-voz.ps1` |
| `apps/android` | `core/src/*Test/kotlin/graph/core/contrato/` | `./scripts/contrato.sh` |
| `apps/mac` | `Tests/UCoreTests/` | `./contrato.sh` |
| `services/graph` | `scripts/verify-*.js` | `npm test` |
| la raíz | `tools/monorepo/contrato.sh` | `bash tools/monorepo/contrato.sh` |

Todos los jueces terminan con una de tres líneas: `CONTRATO INTACTO: N promesas.`, `CONTRATO ROTO:
M promesa(s) incumplida(s).` o `NO SE PUDO JUZGAR: …`. La tercera no es un rojo de las promesas: el
juez no llegó a correr.

Las etapas tienen skill, y son las mismas en todos los proyectos: `/especifica`, `/fases`,
`/promesas`, `/implementa`, `/verifica` y `/a-main`. El portal (`apps/web`) no numera promesas, por
decisión del dueño; su CI se exige igual.

## Reglas comunes

1. **Trabaja desde la carpeta del proyecto.** `cd apps/windows` antes de abrir Claude o Codex: así
   cargan su guía y sus reglas. Estas reglas comunes y las skills de la raíz llegan a todas las
   carpetas; los ganchos y los permisos de Claude Code, no: solo valen los de la carpeta donde se
   abre la sesión.
2. **Un agente, un árbol.** Dos agentes no comparten árbol de trabajo. Cada uno crea el suyo con
   `bash tools/monorepo/arbol.sh nuevo <persona>/<que-hace>` antes de su primera edición, y lo
   cierra con `arbol.sh cerrar` cuando su PR está mergeado. Un guardia detiene al que edita o
   commitea en el árbol de otra sesión. El detalle está en `.claude/rules/ramas-y-commits.md`.
3. **Cada proyecto se basta solo.** Se construye, se prueba y se despliega desde su carpeta. Nada
   importa archivos de otro proyecto con `../`. Lo que se comparta irá a `packages/`, que aún no
   existe.
4. **La raíz no crece sin querer.** Solo admite `apps/`, `services/`, `docs/`, `tools/` y los
   archivos del repo. Una carpeta nueva va dentro de su proyecto: `u/` y `medidor/` son de Windows.
   Lo comprueba `tools/monorepo/comprobar-raiz.sh`, en el portero y en el CI.
5. **Una rama es una cosa, y `main` solo cambia por PR.** Ramas `<persona>/<que-hace>`, nacidas de
   `main` fresco, que duran de medio día a tres días. Una feature que cruza proyectos es una sola
   rama y un solo PR. `main` está protegido: exige el check `compuerta`.
6. **Commits en la voz del repo:** `tipo(ámbito): lo que el sistema ahora hace`, en español. El
   ámbito es el proyecto o el módulo: `feat(web)`, `fix(graph)`, `chore(monorepo)`.
7. **El portero se activa una vez por clon:** `git config core.hooksPath .githooks`. El de la raíz
   bloquea el push a `main` y llama al portero de cada proyecto que la rama toca: Windows, Android,
   Mac y Graph. Cada uno exige que compile, que su contrato esté intacto y que la rama traiga su
   propia promesa. Al portal lo juzga su CI.
8. **Una compuerta en el CI:** `monorepo.yml` corre en todos los PRs, mira qué proyectos toca y
   llama al CI de cada uno (`.github/workflows/<proyecto>-*.yml`). **Graph y el portal se despliegan
   solos** al mergear a `main`, después de sus tests (`vercel-desplegar.yml`, con prueba de humo y
   rollback). La producción de hoy (`graph-eight-pied`, `itsmiracleai.com.co`) sigue saliendo de los
   repos viejos hasta el corte: `docs/monorepo/despliegue.md`.
9. **Cada máquina toca lo que puede verificar.** Desde un Mac no se toca `apps/windows/`, y desde
   Windows no se toca `apps/mac/`. Graph, web y Android se tocan desde cualquiera. El detalle está
   en `.claude/rules/solo-mac.md`.
10. **Releases de GitHub: solo Windows.** Las Ü instaladas en Windows buscan su actualización entre
    las 10 releases más recientes de este repo (Velopack). Si otro producto publicara releases aquí,
    las dejaría sin actualizaciones. Mac y Android publican artefactos, no releases.
11. **Nada secreto en el repo: es público.** Claves, tokens y keystores van en los secretos de
    GitHub Actions, en Vercel o en un `.env` ignorado.

## Herramientas

- Tu árbol de trabajo, y quién está en cuál: `bash tools/monorepo/arbol.sh` (`nuevo`, `estado`,
  `tomar`, `cerrar`, `limpiar`).
- Poner al día una rama que nació antes del monorepo:
  `git fetch origin && bash <(git show origin/main:tools/monorepo/ponerse-al-dia.sh)`
- Traer lo que se empuje a los repos de origen mientras no estén archivados:
  `tools/monorepo/importar.sh`
- El mapa del código (`graphify`): se instala con `tools/graphify/instalar.ps1` (Windows) o
  `bash tools/graphify/instalar.sh` (Mac), y desde ahí se rehace solo tras cada commit, cambio de
  rama y pull. Hay un mapa por proyecto, en `<proyecto>/graphify-out/`, que no se versiona. Cuándo
  usarlo (medido con agentes el 2026-10-01; la guía está en `docs/herramientas/`):
  - **A quién afecta tu rama:** `bash tools/graphify/impacto.sh`. Una llamada da, por cada símbolo
    que cambiaste, quién lo usa desde fuera, con archivo y línea. Córrelo antes de tocar algo
    compartido y antes del PR; cada PR lo recibe además como comentario.
  - **Quién depende de una pieza:** `graphify affected "Nombre"`, dentro de la carpeta del proyecto.
  - **Una pregunta amplia, sin nombre que buscar:** `graphify query "…"` una vez para saber por
    dónde empezar, y después se lee el código.
  - **Si ya tienes el nombre exacto, busca directo.** Consultar el mapa antes de cada búsqueda no
    ahorra nada: se midió, y sumaba pasos.
- **La constitución de Ü** (quién es, cómo habla, cuándo obedece sin preguntar y cómo trata a un
  médico o a una persona) vive en tres copias que deben decir lo mismo:
  `apps/windows/windows-client/src/Voice/ConstitucionDeU.cs`,
  `services/graph/src/application/prompts/ConstitucionDeU.js` y
  `apps/android/core/src/commonMain/kotlin/graph/core/domain/ConstitucionDeU.kt`. Se editan las tres
  a la vez y lo comprueba `bash tools/monorepo/constitucion.sh` (corre en el CI de la raíz). El mapa
  de todos los prompts está en `docs/monorepo/prompts-de-u.md`.

## Este archivo

Claude lo recibe por una copia en `.claude/rules/monorepo.md`, porque un `@AGENTS.md` importado
desde una subcarpeta no se carga sin preguntar. Después de editarlo, corre
`bash tools/monorepo/agentes.sh`; el CI falla si las dos copias difieren.
