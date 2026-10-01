# La arquitectura del monorepo

Decidida y aplicada el 2026-09-28: la importación en #126 y el orden en el PR que trae este archivo.
Cada decisión lleva su porqué y, cuando se pudo, la medida que la sostiene.

## El árbol

```
apps/
  windows/        Ü para Windows (C# · .NET 8 · WPF), con su estructura interna de siempre
  mac/            Ü para Mac (Swift)
  android/        Ü para Android (Kotlin · Gradle)
  web/            Miracle Notes, el portal clínico (Next.js · Supabase)
services/
  graph/          Graph, el cerebro: API, LLM, memoria, Provider Studio (Node · Python · Vercel)
docs/
  monorepo/       este documento, el método común y el plan de la fase 2
  herramientas/   graphify
tools/monorepo/   el guardia de los árboles, el motor de los porteros y su contrato; importar,
                  ponerse al día, comprobar la raíz, la copia de reglas para Claude
.github/          un workflow por proyecto, la compuerta (monorepo.yml) y la plantilla de PR
.githooks/        el portero del monorepo (un despachador) y los ganchos del guardia de árboles
.claude/          lo común para Claude: CLAUDE.md, las reglas comunes, las skills del método y el
                  gancho del guardia
AGENTS.md         el mapa y las reglas comunes
README.md         el mapa para personas
```

`apps/` guarda lo que se instala o se abre; `services/`, lo que corre en un servidor para todas
ellas. Es la convención de Turborepo y Nx, y la reconoce cualquiera que llegue. `packages/`, para
código compartido, se crea cuando haya algo que compartir (ver la fase 2).

## Por qué un monorepo

Es un solo producto, y sus piezas cambian a la vez. La API de Graph cambia con los tres clientes, y
el portal con el agente de Windows (los valores clínicos, la exportación de la nota). En los repos
separados había cinco ramas con el mismo nombre en dos repos: eran la misma feature partida, y había
que mergearlas a la vez. Aquí son una rama y un PR.

**Sin herramienta de monorepo** (Nx, Turborepo, Bazel). Son cinco lenguajes sin código compartido.
Esas herramientas pagan con la caché y con saber qué proyectos afecta un cambio, y eso vale cuando
hay dependencias internas; aquí no las hay. Cada proyecto se construye con su herramienta de
siempre, desde su carpeta. Se revisa cuando exista `packages/`.

**El mismo repo de siempre, y no uno nuevo.** Las Ü instaladas buscan su actualización en las
releases de este repo, Graph dispara aquí `windows-release.yml`, y aquí viven los 7 secretos de
Actions, el historial de PRs y los 8 colaboradores. Un repo nuevo obligaba a mover todo eso.

## Las tres reglas del árbol

1. **Cada proyecto se basta solo.** Se construye, se prueba y se despliega desde su carpeta, y nada
   importa archivos de otro proyecto con `../`. Por eso se puede trabajar con uno solo
   (`git sparse-checkout set apps/web`) o sacarlo a su propio repo (más abajo).
2. **Windows se movió en bloque**, con su estructura interna intacta. Sus scripts encuentran su
   raíz con `Split-Path -Parent $PSScriptRoot`, así que siguieron funcionando. El README de #126
   decía que moverlo rompería el feed de actualizaciones, y no era verdad: el feed depende del
   repo, no de la carpeta.
3. **La raíz solo guarda lo común**, y lo comprueba una máquina: `tools/monorepo/comprobar-raiz.sh`,
   desde el portero y desde el CI. La raíz llegó a 33 entradas porque nada impedía añadir otra.

Tres nombres de la raíz se eligieron pensando en las ramas abiertas. Git solo lleva los archivos
nuevos de una rama a la carpeta nueva si la vieja deja de existir en `main`:

- **`tools/` y no `scripts/`**: las ramas abiertas traían 17 scripts nuevos a `scripts/`.
- **Nada de `docs/specs/` en la raíz**: traían 58 specs.
- **`.claude/CLAUDE.md` y no `CLAUDE.md`**: dos ramas editan el `CLAUDE.md` de Windows, y sus
  cambios tienen que llegar a `apps/windows/CLAUDE.md`.

## Dónde viven las reglas, y quién las lee

| Qué | Dónde | Cómo llega |
|---|---|---|
| El mapa y las reglas comunes | `AGENTS.md`, con una copia en `.claude/rules/monorepo.md` | Codex lee los `AGENTS.md` desde la raíz hasta su carpeta. Claude carga `.claude/rules/` de la raíz desde cualquier carpeta |
| Reglas comunes largas | `.claude/rules/` de la raíz: ramas y commits, qué toca cada máquina | igual, desde cualquier carpeta |
| Reglas de un proyecto | su `CLAUDE.md`, su `AGENTS.md` y su `.claude/rules/` | al abrir la sesión en su carpeta, o al leer un archivo suyo |
| Skills del método | `.claude/skills/` de la raíz: `/especifica`, `/fases`, `/promesas`, `/implementa`, `/verifica`, `/a-main` | desde cualquier carpeta (medido el 2026-09-30) |
| Skills de un proyecto | su `.claude/skills/`, si las tiene | al abrir ahí o al tocar un archivo suyo |
| Hooks, permisos, MCP | `.claude/settings.json` de la raíz y de cada proyecto, `.mcp.json` | **solo** los de la carpeta donde se abre la sesión |

Lo midió un experimento el 2026-09-28, con Claude Code 2.1.276. En un repo de juguete puse un
marcador distinto en cada sitio y abrí Claude desde una subcarpeta. Cargó el `.claude/CLAUDE.md` y
las reglas de la raíz, el `CLAUDE.md` y las reglas de la subcarpeta, y **no** un `@../AGENTS.md`
importado. Un import que sale de la carpeta de trabajo pide permiso, y sin nadie que conteste no se
carga. Por eso las reglas comunes son una copia generada (`tools/monorepo/agentes.sh`) y no un
import, y el CI falla si la copia y `AGENTS.md` difieren.

Dos límites que conviene saber:

- Claude Code **no hereda hooks ni `settings.json` entre carpetas**, en ningún sentido. Un hook de
  `apps/windows/.claude/settings.json` no corre en una sesión abierta en la raíz, y uno de la raíz
  no corre en una sesión abierta en `apps/windows` (medido el 2026-09-30 con un gancho que dejaba
  una marca). Por eso el gancho del guardia de árboles está repetido en la raíz y en cada proyecto,
  y `comprobar-raiz.sh` falla si falta en alguno. Las skills sí llegan de la raíz a las subcarpetas.
- Codex reparte **32 KiB** entre todos los `AGENTS.md` que junta. El `CLAUDE.md` de Windows ronda
  las 490 líneas; si algún día pasa a `AGENTS.md`, hay que partirlo (fase 2).

## Porteros y CI

**El portero es un despachador** (`.githooks/pre-push`). Bloquea el push a `main` mirando la ref
remota, averigua qué proyectos tocan los commits empujados y llama al portero de cada uno
(`<proyecto>/.githooks/pre-push`). Cada portero se ubica por su propia ruta.

Los de Windows, Mac y Graph solo declaran lo suyo —qué es código, qué es una promesa, cómo se
compila y cómo se juzga— y cargan **el motor común** (`tools/monorepo/portero.sh`), que hace las
cuatro comprobaciones y juzga el commit que se empuja, no el árbol de trabajo. El motor salió del
portero de Android, que ya lo hacía; el de Android sigue con su propia copia, porque desde una
máquina sin su SDK no se podía verificar el cambio. El método entero está en
[`metodo.md`](metodo.md).

**Un CI por proyecto, y una compuerta.** En `main`, cada workflow se dispara solo, por sus rutas. En
un PR los llama `monorepo.yml`, que mira qué proyectos toca el PR:

| Workflow | Proyecto | Qué juzga |
|---|---|---|
| `monorepo.yml` | todos | **la compuerta**: la raíz en orden, el contrato de sus herramientas, y el CI de cada proyecto que el PR toca |
| `windows-contrato.yml` | Windows | el contrato del grafo y el de la voz |
| `windows-release.yml` | Windows | la release; lo dispara Graph **por este nombre**, que no se cambia |
| `mac-build.yml` | Mac | su contrato, la app empaquetada y el binario universal |
| `android-apk.yml` | Android | su contrato y el APK release |
| `web-ci.yml` | web | lint, typecheck, tests y build |
| `graph-ci.yml` | Graph | su contrato (`npm test`) |
| `vercel-desplegar.yml` | Graph y web | el despliegue a Vercel tras los tests, con prueba de humo y rollback (ver `despliegue.md`) |

`main` está protegido y exige un solo check: `compuerta`. Es uno solo por una trampa de GitHub: un
workflow con filtro de rutas que no llega a correr deja su check «pendiente» para siempre, y eso
bloquearía cualquier PR que no toque ese proyecto. La compuerta corre siempre y decide ella a quién
llamar; un proyecto que el PR no toca sale «skipped», que cuenta como verde.

## Releases: solo Windows

Velopack, el actualizador de Windows, busca `releases.win.json` entre las **10 releases más
recientes** del repo. Si otro producto publicara releases aquí, bastarían 10 para que las Ü
instaladas dejaran de ver actualizaciones, sin ningún error. Mac y Android publican artefactos de
CI, no releases, y los tags `v<versión>` son de Windows.

## El nombre del repo no cambia todavía

GitHub redirige un repo renombrado (lo medí: la API responde 301 y luego 200), pero hay tres
problemas:

- **El token se pierde.** Las Ü instaladas consultan con un token, y .NET lo descarta al seguir una
  redirección. Con el repo público funciona sin él, pero con el límite de 60 consultas por hora por
  IP.
- **El dispatch de Graph.** Es un POST, y recibe un 307.
- **Vercel.** Enlaza los proyectos a su repo.

Se hace en la fase 3, en este orden: renombrar, publicar enseguida una versión cuyo `Config.cs` ya
use el nombre nuevo (con la migración de URL que ese archivo ya sabe hacer), y actualizar Graph y
Vercel.

## Cómo se hace…

**Añadir un proyecto.**
1. Su carpeta en `apps/` o en `services/`, con su README, su `AGENTS.md` y un `CLAUDE.md` cuya
   primera línea sea `@AGENTS.md`.
2. Su workflow `<proyecto>-*.yml`, con `workflow_call`, `push` a `main` con sus `paths`, y
   `working-directory`; y su trabajo en la compuerta (`monorepo.yml`).
3. Darlo de alta en `tools/monorepo/comprobar-raiz.sh` y en `PROYECTOS` de `.githooks/pre-push`.
4. Su portero en `<proyecto>/.githooks/pre-push` y su juez: ver «Añadir el método a un proyecto
   nuevo» en [`metodo.md`](metodo.md).
5. Su `.claude/settings.json`, con el gancho del guardia de árboles.

**Trabajar con un solo proyecto.**

```bash
git clone --sparse https://github.com/ZevCorp/U-Windows-App.git && cd U-Windows-App
git sparse-checkout set apps/web
```

**Sacar un proyecto a su propio repo, con la historia de antes del movimiento.** filter-repo no
sigue renombres, así que hay que nombrar las dos carpetas:

```bash
git filter-repo --path web/ --path apps/web/ --path-rename web/: --path-rename apps/web/:
```

**Poner al día una rama que nació antes de este orden:**
`git fetch origin && bash <(git show origin/main:tools/monorepo/ponerse-al-dia.sh)`.

**Traer lo que se empuje a los repos de origen:** `tools/monorepo/importar.sh`, hasta que se
archiven.

## Lo que se midió al hacerlo

- **El movimiento:** 1.714 archivos, todos renombrados al 100 %. `git log --follow` conserva la
  historia entera, 104 commits en `services/graph/web/server.js`, y `git blame` no le atribuye ni
  una línea al commit del movimiento.
- **Las ramas abiertas:** ensayo contra las 75. Con `ponerse-al-dia.sh`, ninguna rama viva quedó con
  un conflicto que no tuviera ya antes. Cambian cuatro ramas que no son trabajo vivo: dos paradas
  desde el 26 de julio, una del 13 de agosto que modifica un archivo borrado por muerto
  (`agente-arquitecto`) y una que ya estaba integrada en `main`.
- **Los porteros:** cinco empujes simulados. Solo web y solo la raíz pasan. Una carpeta intrusa en
  la raíz y un push directo a `main` quedan bloqueados.
- **El portero de Windows**, desde su carpeta nueva: compila y juzga los dos contratos en 120 s. Con
  el juez de la voz borrado a propósito, da rojo.
- **La Mac:** `verify.py` lee sus 41 capacidades, 51 specs y 35 herramientas de Windows desde las
  rutas nuevas.
- **Ü desde cero:** los cuatro proyectos de `u/` compilan en `apps/windows/u`.
- **Graph:** su `npm test` pasa tal cual, 33 verificaciones en 1 min 21 s. (Desde el 2026-09-30
  `npm test` es su contrato y las corre cuatro a la vez: 34 en ~5 s.)
