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
  monorepo/       este documento y el plan de la fase 2
  herramientas/   graphify
tools/monorepo/   importar, ponerse al día, comprobar la raíz, la copia de reglas para Claude
.github/          un workflow por proyecto, monorepo.yml y la plantilla de PR
.githooks/        el portero del monorepo: un despachador
.claude/          lo común para Claude: CLAUDE.md, reglas comunes y la skill /avisa
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
| Reglas comunes largas | `.claude/rules/` de la raíz: ramas y commits, aviso en Slack, qué toca cada máquina | igual, desde cualquier carpeta |
| Reglas de un proyecto | su `CLAUDE.md`, su `AGENTS.md` y su `.claude/rules/` | al abrir la sesión en su carpeta, o al leer un archivo suyo |
| Skills | `.claude/skills/` de la raíz (`/avisa`) y de cada proyecto | las del proyecto, al abrir ahí o al tocar un archivo suyo |
| Hooks, permisos, MCP | `<proyecto>/.claude/settings.json`, `.mcp.json` | **solo** si la sesión se abre en esa carpeta |

Lo midió un experimento el 2026-09-28, con Claude Code 2.1.276. En un repo de juguete puse un
marcador distinto en cada sitio y abrí Claude desde una subcarpeta. Cargó el `.claude/CLAUDE.md` y
las reglas de la raíz, el `CLAUDE.md` y las reglas de la subcarpeta, y **no** un `@../AGENTS.md`
importado. Un import que sale de la carpeta de trabajo pide permiso, y sin nadie que conteste no se
carga. Por eso las reglas comunes son una copia generada (`tools/monorepo/agentes.sh`) y no un
import, y el CI falla si la copia y `AGENTS.md` difieren.

Dos límites que conviene saber:

- Claude Code **no hereda hooks ni `settings.json` entre carpetas**. Un hook de
  `apps/windows/.claude/settings.json` no corre en una sesión abierta en la raíz.
- Codex reparte **32 KiB** entre todos los `AGENTS.md` que junta. El `CLAUDE.md` de Windows ronda
  las 490 líneas; si algún día pasa a `AGENTS.md`, hay que partirlo (fase 2).

## Porteros y CI

**El portero es un despachador** (`.githooks/pre-push`). Bloquea el push a `main` mirando la ref
remota, averigua qué proyectos tocan los commits empujados y llama al portero de cada uno
(`<proyecto>/.githooks/pre-push`), con sus reglas tal como venían. Cada portero se ubica por su
propia ruta, así que funciona igual si el proyecto se saca del monorepo. El de Windows da rojo si
falta un contrato; antes lo saltaba, y tras el movimiento lo habría saltado sin avisar.

**Un CI por proyecto**, que corre desde su carpeta y solo cuando esa carpeta cambia:

| Workflow | Proyecto | Qué juzga |
|---|---|---|
| `windows-contrato.yml` | Windows | el contrato del grafo y el de la voz |
| `windows-release.yml` | Windows | la release; lo dispara Graph **por este nombre**, que no se cambia |
| `mac-build.yml` | Mac | contratos, app empaquetada, binario universal |
| `android-apk.yml` | Android | el APK release |
| `web-ci.yml` | web | lint, typecheck, tests y build |
| `graph-ci.yml` | Graph | sus 33 verificaciones offline (`npm test`) |
| `monorepo.yml` | la raíz | la raíz en orden, las reglas sin deriva, los porteros parsean |

Si algún día se protege `main` con checks obligatorios, hay una trampa: un workflow con filtro de
rutas que no llega a correr deja su check «pendiente» para siempre y bloquea el merge. La solución
es una compuerta única que corra siempre y mire qué cambió; `monorepo.yml` es su sitio natural.

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
1. Su carpeta en `apps/` o en `services/`, con su README y su `AGENTS.md`.
2. Su workflow `<proyecto>-*.yml`, con `paths` y `working-directory`.
3. Darlo de alta en `tools/monorepo/comprobar-raiz.sh` y en `PROYECTOS` de `.githooks/pre-push`.
4. Si tiene portero local, ponerlo en `<proyecto>/.githooks/pre-push`.

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
- **Graph:** su `npm test` pasa tal cual, 33 verificaciones en 1 min 21 s.
