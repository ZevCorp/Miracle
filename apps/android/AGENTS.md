# Ü para Android — guía para trabajar en `apps/android`

El cliente de Ü para Android, en Kotlin: una carita flotante que opera el teléfono por gestos y por
lo que ve en pantalla, con el cerebro en Graph. Un núcleo multiplataforma sin Android (`core/`) y
una capa de adaptadores (`app/`): ver [`ARCHITECTURE.md`](ARCHITECTURE.md). Las reglas comunes del
monorepo (ramas, commits, qué toca cada máquina) están en el [`AGENTS.md`](../../AGENTS.md) de la
raíz.

Todos los comandos de aquí se corren **desde esta carpeta** (`cd apps/android`). Hace falta el SDK
de Android (`ANDROID_HOME`, o `sdk.dir` en `local.properties`) y un JDK 17.

## El ciclo

Es el del monorepo ([`docs/monorepo/metodo.md`](../../docs/monorepo/metodo.md)), y aquí está
escrito entero en [`docs/como-trabajamos.md`](docs/como-trabajamos.md): léelo antes de tocar código.

```
1.  rama <persona>/<que-hace> desde main fresco
2.  la spec:      docs/specs/NNN-<slug>.md, con la tabla «| # | Promesa |»
3.  la promesa:   core/src/commonTest/kotlin/graph/core/contrato/ContratoNNN<Nombre>.kt,
                  un método promesaN por fila, y verla ROJA
4.  el código, hasta que salga verde
5.  ROMPE el código a propósito: si la promesa no se pone roja, no vale nada
6.  pruébalo con el APK release en el teléfono, en dos apps distintas
7.  git push: el portero decide (1-2 min)
8.  PR con la evidencia → squash merge
```

| Qué | Dónde |
|---|---|
| Specs | `docs/specs/NNN-*.md`. La spec NNN numera sus promesas desde NNN×100+1; la 001 usa 1-99 |
| Promesas | `core/src/commonTest/kotlin/graph/core/contrato/` y `core/src/jvmTest/…/contrato/` |
| El juez | `./scripts/contrato.sh` → `CONTRATO INTACTO: N promesas.` |
| El portero | `.githooks/pre-push`: compila en release, contrato intacto, y la rama trae su promesa |
| El CI | [`android-apk.yml`](../../.github/workflows/android-apk.yml): el contrato y el APK release |

## Compilar y correr

```bash
./gradlew :app:compileReleaseKotlin     # nivel 1: compila lo que se distribuye
./scripts/contrato.sh                   # nivel 2: el contrato
./gradlew :app:assembleRelease          # el APK
```

## Lo que hay que saber antes de tocar

- **El portero de aquí es más estricto que el del resto.** Una rama `chore/` o `refactor/` solo
  queda exenta de traer promesa si además no toca código de producción.
- **El juez cruza specs y tests.** Una fila sin test sale `SIN JUEZ`, un test con `@Ignore` sale
  silenciado, y un test sin fila no deja juzgar. Retirar una promesa es tacharla en la spec, no
  borrar su test.
- **El APK de CI lleva las claves horneadas desde los secretos de GitHub.** El repo y sus
  artefactos son públicos: ninguna clave va a un archivo versionado.
- **Releases de GitHub: no.** Android publica el APK como artefacto de CI. Las releases del repo son
  de Windows, y diez de otro producto dejarían a las Ü instaladas sin actualizaciones.
- **La corrida a mano se cuenta.** En el PR va en qué dos apps se probó y qué pasó, con el log.
