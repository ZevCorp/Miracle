# Fase 2: lo mejor de cada proyecto, para todos

La fase 1 (2026-09-28) dejó cada proyecto en su carpeta, con sus reglas tal como venían. Esta fase
decide qué reglas y qué arquitectura comparten, para que trabajar en cualquier carpeta se sienta
igual y los proyectos encajen entre sí. Lo de abajo sale de leer los cinco proyectos ese día; cada
afirmación lleva el archivo que la sostiene.

## Estado al 2026-09-30

El método común ya está aplicado: ver [`metodo.md`](metodo.md). De la lista de «Qué llevar a todos»:

| # | Qué | Estado |
|---|---|---|
| 1 | Un CI que juzgue las promesas, y una compuerta única | **hecho**: el contrato de Android corre en su CI, y `main` exige `compuerta` |
| 2 | Secretos fuera del repo | **pendiente**, y es del dueño: hay que rotar (ver «Deudas») |
| 3 | Un juez con los tres veredictos | **hecho** en Graph y Mac; Windows y Android ya lo tenían. El portal queda fuera por decisión del dueño |
| 4 | Un portero que juzgue lo que se empuja | **hecho**: `tools/monorepo/portero.sh`, en Windows, Mac y Graph. Android sigue con su copia |
| 5 | Evidencia en cada PR | **a medias**: la plantilla la pide; solo Windows produce su tabla sola (`verificar.ps1`) |
| 6 | Decisiones y estado medido en cada proyecto | pendiente |
| 7 | La misma guía para agentes | **hecho**: `AGENTS.md` y `CLAUDE.md` en cada proyecto. El `CLAUDE.md` de Windows sigue largo |
| 8 | Las skills del flujo, generalizadas | **hecho**: viven en `.claude/skills/` de la raíz |

Y dos cosas que no estaban en la lista: **un agente, un árbol** (`tools/monorepo/arbol.sh`, con su
guardia), y el contrato de las herramientas de la raíz (`tools/monorepo/contrato.sh`).

Lo de abajo es la foto del 2026-09-28, tal como se escribió.

## Dónde está cada proyecto

| | Windows | Android | Mac | web | Graph |
|---|---|---|---|---|---|
| Tamaño | 520 archivos, C# 86k | 199, Kotlin 32k | 60, Swift 3,7k | 558, TS/TSX 66k | 404, JS 62k + Py 3k |
| Cómo trabaja | spec → promesas en rojo → código → portero → PR con evidencia | el mismo método, portado (`docs/como-trabajamos.md`) | spec de migración y matriz de paridad medida | registro de decisiones (`docs/decisiones.md`) | tests que enumeran lo que juzgan (D1-D10) |
| Juez | 313 promesas en `Contrato.cs`, más voz, mapeador y núcleo | 171 promesas; `scripts/contrato.sh` cruza spec y tests | 25 contratos (`NativeContract`) | ~752 casos de vitest | 33 verificaciones offline |
| Portero local | sí | sí, y el más riguroso | no | no | no |
| CI | contrato y voz | APK, **sin el contrato** | contratos y build | lint, typecheck, test, build | desde el 2026-09-28 |
| Guía para agentes | `CLAUDE.md` de 490 líneas y 7 reglas | ninguna | ninguna (la regla vive en la raíz) | `AGENTS.md` de 5 líneas | `CLAUDE.md` de 9 líneas, solo graphify |

**Lo mejor de cada uno:**

- **Windows**: el método entero. Ninguna línea entra antes que la promesa que la juzga, se sabotea
  para comprobar que la promesa muerde, y los aprendizajes quedan escritos con fecha.
- **Android**: el juez de trazabilidad. Detecta promesas sin test, tests silenciados, huérfanos y
  repetidos, y sale con 99 cuando no pudo juzgar. Su portero juzga **lo que se empuja**, en un
  worktree por commit, no el árbol de trabajo.
- **Mac**: estado medido y no declarado. `verify.py` guarda evidencia, incluidas mutaciones, y
  ninguna capacidad cuenta como migrada por existir su archivo.
- **web**: la compuerta de CI más completa, y decisiones escritas con «Decisión / Por qué / Contra».
- **Graph**: capas limpias en `src/` (dominio, casos de uso, infraestructura) y dobles offline de
  Supabase y del LLM.

## Qué llevar a todos, por orden de impacto

1. **Un CI por proyecto que juzgue sus promesas, no solo que compile.** Graph ya lo tiene. Al de
   Android le falta correr `scripts/contrato.sh`. Cuando se proteja `main`, una compuerta única en
   `monorepo.yml` (ver la arquitectura).
2. **Secretos fuera del repo.** Es público. Ver «Deudas» abajo: hay tokens que rotar hoy.
3. **Un juez de contrato común**, con el modelo de Android: promesas numeradas por spec en bloques
   de 100, un juez que cruza spec y tests, y que distingue «roto» (N) de «no pude juzgar» (99).
   Windows ya lo hace a su manera, y Mac y web tienen tests sin trazabilidad a una spec.
4. **Un portero común que juzgue lo que se empuja**, con el motor de Android (worktree por commit,
   ref remota, exención por el diff y no por el nombre de la rama), y que el despachador de la raíz
   llame igual para todos.
5. **Evidencia en cada PR**: la plantilla ya lo pide. Falta que cada proyecto sepa producir su
   tabla, como `verificar.ps1` en Windows.
6. **Decisiones y estado medido**: `docs/decisiones.md` en cada proyecto, al estilo de web, y el
   estado medido de la Mac para lo que se migra.
7. **La misma guía para agentes en cada proyecto**: un `AGENTS.md` (lo lee Codex; 32 KiB en total)
   y un `CLAUDE.md` cuya primera línea sea `@AGENTS.md`. El de Windows hay que partirlo.
8. **Las skills del flujo** (`/especifica`, `/promesas`, `/implementa`, `/verifica`, `/a-main`)
   generalizadas: hoy son de Windows y dan por hecho `Contrato.cs` y `dotnet`.

## `packages/`: lo que se comparte

Hoy nada se comparte con código, y se nota:

- **El protocolo de turno** entre los clientes y Graph (`POST /api/v1/agent/turn`) tiene 6 copias en
  5 lenguajes y ningún esquema: `Protocol.cs:77`, `TurnProtocol.kt:78` (que dice copiar «los nombres
  de allá, tal cual»), `UCore/Protocol.swift`, el `backend/` de Windows y el comentario de
  `AgentTurnService.js:14`.
- **Las cabeceras de identidad** (`X-API-Key`, `X-Miracle-App`, `X-Miracle-Feature`) y sus valores.
- **La enseñanza y los workflows** (`windows-graph/src/Contracts.cs` es la fuente, Android la copia).
- **La API clínica, la exportación de notas y las métricas**, hoy en documentos
  (`graph/docs/clinical-api-contract.md`, con una copia vieja en `web/docs`).
- **El vocabulario clínico** (`vital.*`), solo en `web/lib/clinical/vital-concepts.ts`. Windows lo
  necesitará en C#.

La propuesta es `packages/contratos/` con esquemas JSON y ejemplos reales como fixtures, y que cada
proyecto genere o compruebe sus tipos contra ellos en su CI. Así, un cambio de la API de Graph que
rompe un cliente se ve en el mismo PR.

Aparte, **una sola historia de migraciones de Supabase.** Graph (20) y web (82) migran la misma
base, y las dos crean `clinical_templates` con `if not exists`: la segunda no hace nada y no avisa.
Lo de Android (tablas `graph_*`, las Edge Functions `publish-release` y `graph-signup`) no está
versionado en ningún sitio. La propuesta es `infra/supabase/`.

## Deudas encontradas al ordenar

No se arreglaron en la fase 1, porque no eran de orden. Están por urgencia.

**Seguridad, y es lo primero:**

- `apps/android/RELEASING.md` tiene en claro el token de admin de la Edge Function
  `publish-release`, y el keystore de firma está versionado con sus contraseñas en
  `app/build.gradle.kts`. El documento dice que el repo es privado, y es público. Con eso cualquiera
  puede firmar un APK y publicarlo como actualización para todos los Android. **Hay que rotar el
  token.**
- `apps/windows/windows-client/src/Config.cs:39` tiene el token Bearer de `u-windows-backend`, que
  sigue vivo.
- `apps/web/.mcp.json` conecta un MCP de Supabase **de producción** con escritura y sin
  `read_only`.
- Graph: `TEMPORARY_DISABLE_AUTH` se respeta en cualquier entorno en `requireAuth.js:68`, pero
  `requireClinicalAuth.js:97` lo bloquea en producción.

**Funcionamiento:**

- Graph dispara `windows-release.yml` con `{ version, request_id }` y sin `user_message`, que el
  workflow exige (`WindowsAppReleaseService.js:124`). Las 5 últimas releases salieron bien, pero
  todas con `request_id` de persona (`jose-…`, `claude-…`), así que se lanzaron a mano. Desde
  Provider Studio fallarían, porque GitHub rechaza un dispatch al que le falta un input obligatorio.
- ~~El contrato de Android está rojo en su propio `main` (promesa 246), desde antes del monorepo.~~
  No era el código: el juez leía las fuentes con los finales de línea del disco, y en un clon de
  Windows (CRLF) la 246 no encontraba «la primera línea en blanco». Corregido el 2026-09-30 en las
  siete lecturas del contrato: 171 promesas intactas también en Windows.
- `backend/` de Windows se llama «legacy», pero recibió 7 commits en septiembre (memoria,
  recordatorios). Hay que decidir si se queda o se absorbe en Graph.

**Orden fino** (cada proyecto, en su carpeta):

- **Documentos viejos**: `WINDOWS.md`, `PRODUCTION.md`, `CONTEXTO.md` y los `MIRACLE_*.md` de web,
  y el README de Graph, que aún describe el motor de workflows original.
- **Referencias muertas**: `docs/como-trabajamos.md` en Windows, `scripts/ci-local.ps1`,
  `tests/ContratoDelGrafo/bronce/`, y 3 enlaces de `plan-plata-real.md`. (2026-09-30: corregidas
  las de las reglas y el CI; quedan las de `docs/graphify.md` y `plan-plata-real.md`, que son
  historia.)
- **Código dormido que se despliega** en Graph: `chrome-extension-src`, `web/public/plugin`,
  `web/public/miracle` y `vision-live`.
- **Configuración que se contradice**:
  - ~~«Somos tres» en las reglas, cuando hay 8 personas con escritura.~~ Corregido el 2026-09-30.
  - La URL de Supabase escrita a mano en 6 archivos de Android.
  - ~~El `.gitignore` de Graph ignora su propio `.env.example`.~~ Corregido el 2026-09-30, y
    también en el de la raíz.
  - `verify.py` de la Mac falla en Windows si no se corre en modo UTF-8.

## Fase 3: despliegues

- **Vercel**:
  - `graph` → Root Directory `services/graph`.
  - `miracle-web` → `apps/web`.
  - Los dos con un Ignored Build Step (`git diff HEAD^ HEAD --quiet -- .`), porque Vercel solo
    sabe saltarse los proyectos no afectados en monorepos de npm/pnpm.
- **Archivar los repos de origen** cuando Vercel ya despliegue desde aquí. Los de `joseph1356k` solo
  los puede archivar Joseph.
- ~~**Renombrar el repo**~~. Hecho el 2026-10-01: es `ZevCorp/Miracle`. Lo que se cuidó está en
  «El nombre del repo» de la arquitectura. Queda poner el nombre nuevo en `WINDOWS_APP_GITHUB_REPO`
  de los proyectos de Vercel cuando Graph se despliegue desde aquí (hoy esa variable solo existe en la producción vieja, que sigue funcionando por la redirección).

## Orden propuesto para la fase 2

1. Seguridad: rotar y sacar los secretos del repo.
2. El contrato de Android en su CI, y el de Graph que ya corre.
3. La guía para agentes común (`AGENTS.md` + `CLAUDE.md` por proyecto) y partir la de Windows.
4. `packages/contratos/` con el protocolo de turno, el primero que duele.
5. El juez y el portero comunes, con el motor de Android.
6. `infra/supabase/` con una sola historia de migraciones.
