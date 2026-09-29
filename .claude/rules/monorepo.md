<!-- GENERADO desde AGENTS.md por tools/monorepo/agentes.sh: no lo edites aquí. Edita AGENTS.md y corre el script. -->

# Ü — el monorepo

Todo Miracle en un solo repo: los clientes de Ü (Windows, Mac y Android), el cerebro (Graph) y el
portal clínico (Miracle Notes). Este archivo es el mapa y las reglas comunes. Las reglas de cada
proyecto viven en su carpeta, tal como venían de su repo.

## Dónde vive cada cosa

| Carpeta | Qué es | Stack | Sus reglas |
|---|---|---|---|
| `apps/windows/` | Ü para Windows, con SAP GUI | C# · .NET 8 · WPF | `apps/windows/CLAUDE.md` y su `.claude/` |
| `apps/mac/` | Ü para Mac | Swift | `apps/mac/README.md` |
| `apps/android/` | Ü para Android | Kotlin · Gradle | `apps/android/docs/como-trabajamos.md` |
| `apps/web/` | Miracle Notes, el portal clínico | Next.js · Supabase | `apps/web/AGENTS.md` |
| `services/graph/` | Graph, el cerebro: API, LLM, memoria, Provider Studio | Node · Python · Vercel | `services/graph/CLAUDE.md` |
| `docs/` | lo del monorepo (`docs/monorepo/`) y las herramientas comunes (`docs/herramientas/`) | | |
| `tools/monorepo/` | scripts del repo | bash | |

`apps/` son las cosas que se instalan o se abren; `services/`, lo que corre en un servidor para
todas ellas. El porqué de cada decisión está en `docs/monorepo/arquitectura.md`.

## Reglas comunes

1. **Trabaja desde la carpeta del proyecto.** `cd apps/windows` antes de abrir Claude o Codex: así
   cargan las reglas, las skills y los hooks de ese proyecto. Claude Code no hereda hooks ni skills
   entre carpetas; estas reglas comunes sí llegan a todas.
2. **Cada proyecto se basta solo.** Se construye, se prueba y se despliega desde su carpeta. Nada
   importa archivos de otro proyecto con `../`. Lo que se comparta irá a `packages/`, que aún no
   existe.
3. **La raíz no crece sin querer.** Solo admite `apps/`, `services/`, `docs/`, `tools/` y los
   archivos del repo. Una carpeta nueva va dentro de su proyecto: `u/` y `medidor/` son de Windows.
   Lo comprueba `tools/monorepo/comprobar-raiz.sh`, en el portero y en el CI.
4. **Una rama es una cosa, y `main` solo cambia por PR.** Ramas `<persona>/<que-hace>`, nacidas de
   `main` fresco, que duran de medio día a tres días. Una feature que cruza proyectos es una sola
   rama y un solo PR. El detalle está en `.claude/rules/ramas-y-commits.md`.
5. **Commits en la voz del repo:** `tipo(ámbito): lo que el sistema ahora hace`, en español. El
   ámbito es el proyecto o el módulo: `feat(web)`, `fix(graph)`, `chore(monorepo)`.
6. **El portero se activa una vez por clon:** `git config core.hooksPath .githooks`. El de la raíz
   bloquea el push a `main` y llama al portero de cada proyecto que la rama toca (hoy Windows y
   Android; los demás los juzga su CI).
7. **Un CI por proyecto:** `.github/workflows/<proyecto>-*.yml`, que corre solo si cambia su
   carpeta. `monorepo.yml` comprueba la raíz en todos los PRs. **Graph y el portal se despliegan
   solos** al mergear a `main`, después de sus tests (`vercel-desplegar.yml`, con prueba de humo y
   rollback). La producción de hoy (`graph-eight-pied`, `itsmiracleai.com.co`) sigue saliendo de los
   repos viejos hasta el corte: `docs/monorepo/despliegue.md`.
8. **Cada máquina toca lo que puede verificar.** Desde un Mac no se toca `apps/windows/`, y desde
   Windows no se toca `apps/mac/`. Graph, web y Android se tocan desde cualquiera. El detalle está
   en `.claude/rules/solo-mac.md`.
9. **Releases de GitHub: solo Windows.** Las Ü instaladas en Windows buscan su actualización entre
   las 10 releases más recientes de este repo (Velopack). Si otro producto publicara releases aquí,
   las dejaría sin actualizaciones. Mac y Android publican artefactos, no releases.
10. **Nada secreto en el repo: es público.** Claves, tokens y keystores van en los secretos de
    GitHub Actions, en Vercel o en un `.env` ignorado.
11. **Cada push que publique commits deja un aviso** en `#miracle-updates` con la skill `/avisa`:
    rama, qué entró, qué proyecto toca y en qué estado quedó. El detalle está en
    `.claude/rules/aviso-en-slack.md`.

## Herramientas

- Poner al día una rama que nació antes de este orden:
  `git fetch origin && bash <(git show origin/main:tools/monorepo/ponerse-al-dia.sh)`
- Traer lo que se empuje a los repos de origen mientras no estén archivados:
  `tools/monorepo/importar.sh`
- El grafo del código: `graphify` (guía en `docs/herramientas/`). `graphify-out/` no se versiona.

## Este archivo

Claude lo recibe por una copia en `.claude/rules/monorepo.md`, porque un `@AGENTS.md` importado
desde una subcarpeta no se carga sin preguntar. Después de editarlo, corre
`bash tools/monorepo/agentes.sh`; el CI falla si las dos copias difieren.
