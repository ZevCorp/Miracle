---
name: juez-rojo
description: Diagnostica un contrato en rojo o un «NO SE PUDO JUZGAR» en cualquiera de los cinco jueces del monorepo (Windows, voz de Windows, Android, Mac, Graph y la raíz) — distingue promesa rota, pendiente, sin juez, enunciado distinto, test silenciado, arnés roto y máquina que no puede juzgar, y dice qué tocar sin tocar el enunciado de la promesa. Úsala cuando un juez salga con CONTRATO ROTO, con código 99, con ⧗ PENDIENTE o ⧗ SIN JUEZ inesperados, cuando el portero bloquee por el contrato, o cuando el usuario diga "el contrato está rojo", "no pasa el juez", "sale 99", "¿por qué falla la promesa N?".
---

# Un juez en rojo

Todos los jueces terminan con una de tres líneas, y significan cosas distintas:

| Última línea | Código | Qué es |
|---|---|---|
| `CONTRATO INTACTO: N promesas.` | 0 | verde (y si dice «N sin juzgar en esta máquina», esas no cuentan como cumplidas) |
| `CONTRATO ROTO: M promesa(s) incumplida(s)…` | M (≤ 98) | promesas que no se cumplen: **es sobre el código** |
| `NO SE PUDO JUZGAR: …` | 99 | el juez no llegó a juzgar: **es sobre el arnés o la máquina**, no sobre el código |

**Regla de oro: nunca se toca el enunciado de una promesa para que pase.** Si una promesa estorba, la
conversación es sobre el contrato, con el dueño.

## 1. Lee la salida entera, no solo la última línea

Copia literal las líneas `✘`, `⧗` y `NO SE PUDO` con lo que llevan debajo. Si la salida es larga,
`… | grep -nE "✘|⧗|NO SE PUDO|PENDIENTE|SIN JU"` y el contexto de cada una.

## 2. Qué significa cada marca, por juez

### Graph — `cd services/graph && npm test`

| Marca | Causa | Qué haces |
|---|---|---|
| `✘ N` con el error debajo | la promesa no se cumple | el código (`/implementa`) |
| `✘ N` + «la juzga con otro enunciado» | el texto en `promesa(N, '…')` no es igual al de la spec | copia el de la spec al verify, letra por letra |
| `⧗ PENDIENTE N` | `pendiente('X')`: la pieza X aún no existe | normal en fase roja; si ya la escribiste, el `require` o el nombre no cuadran |
| `⧗ SIN JUEZ N` | la fila nombra un verify que no existe, o el verify no imprime la marca de N | crea el verify o haz que juzgue la N con `promesas.js` |
| `⏭ N` | `saltar()`: esta máquina no puede (la 22 necesita Postgres) | no es verde; dilo en la evidencia |
| `99` · «no es juez de ninguna fila…» | un `verify-*.js` sin fila ni entrada en «Fuera del contrato» | añádele su fila en la spec, o a «Fuera del contrato» con el porqué |
| `99` · número en dos specs / número que ninguna spec tiene | numeración | `/numera` |
| `99` · falta `node_modules` | | `npm ci` |
| `✘ <juez> salió con código X sin ninguna promesa rota` | algo falló fuera de las promesas (un `require`, un proceso que no cerró) | córrelo solo: `node scripts/verify-<x>.js` |

Para iterar: `node scripts/contrato.js <trozo>` (sale `PARCIAL`, que no es veredicto).

### Android — `cd apps/android && ./scripts/contrato.sh`

| Marca | Causa | Qué haces |
|---|---|---|
| `✘ N · …` + mensaje | el test `promesaN` falla | el código |
| `⧗ PENDIENTE N` | `TODO()` / `NotImplementedError` | normal en fase roja |
| `⧗ SIN JUEZ N` | la fila no tiene `fun promesaN()` en `core/src/*Test/…/contrato/` | escribe el test, con el enunciado literal en `PROMESAS` |
| `✘ N (silenciada: @Ignore)` | un `@Ignore` | quítalo. Retirar una promesa es ~~tacharla~~ en la spec, no silenciar su test |
| `99` · «no es fila de ninguna tabla» (huérfana) | test sin fila | añade la fila, o borra el test si la promesa no existe |
| `99` · «la juzgan dos tests» / «está en dos specs» | numeración | `/numera` |
| `99` · «gradle salió con X sin promesas rotas» | no compila, o falta el SDK/JDK 17 | mira `core/build/contrato.log` |

Lo que el juez cruzó queda en `core/build/contrato.filas.tsv` y `contrato.juzgadas.tsv`. Un test que
lee fuentes de `app/` con regex: cuidado con CRLF (leía mal en clones de Windows hasta el 2026-09-30).

### Mac — `cd apps/mac && ./contrato.sh` (solo macOS; fuera, `./contrato.sh --cruce`)

| Marca | Causa | Qué haces |
|---|---|---|
| `99` · «no cuadran» | cada promesa toca tres sitios: la `func test…`, su llamada en `ContractRunner.swift` **y el número de su línea `PASS: N contracts`**, y la fila `| # | Promesa | Juez |` | arregla el que falte; `--cruce` lo dice en cualquier máquina |
| `✘` y luego `⧗ SIN JUZGAR` | el corredor para en la primera aserción que falla | arregla la primera; las de detrás no se dan por buenas |
| `99` · solo corre en macOS | | el CI (`mac-build.yml`) la juzga; dilo |

### Windows — `cd apps\windows; .\scripts\contrato-del-grafo.ps1` (y `contrato-de-la-voz.ps1`)

| Marca | Causa | Qué haces |
|---|---|---|
| `✘ N. …` con `✘ Tipo: mensaje` e InnerException | la promesa no se cumple | el código |
| `⧗ PENDIENTE: «X» todavía no existe (spec NNN)` | la promesa busca la capacidad por reflexión (`Capacidad("U.WindowsClient.X")`) y no está | fase roja; o tu clase/método se llama distinto de lo que busca la promesa |
| `⚠ NO PUDE JUZGARLA: falta U_REPO` | corriste el contrato sin el script, que es el que pone `U_REPO` | córrelo con el script. Si sale verde sin `U_REPO`, la promesa tiene el defecto de no sumar el fallo (`/revisa` lo marca) |
| `99` · «no llegó a emitir veredicto» | no compiló, o Smart App Control bloqueó el binario (`0x800711C7`) | se juzga **Release**, nunca Debug; mira la compilación arriba |
| La voz: `VOZ ÍNTEGRA` es su verde | | |

Dos contratos más con su script: `u/Contrato` (spec 052) → `.\scripts\contrato-u.ps1`, y el de la
raíz → `bash tools/monorepo/contrato.sh` (corre en un repo de juguete; si falla un `git` dentro de
un gancho desde un árbol enlazado, sospecha de `GIT_DIR`).

## 3. Antes de cambiar código, una pregunta

¿El rojo es **esperado**? En fase roja (`/promesas`), los pendientes tienen que ser exactamente los
de las fases que faltan. Si hay más, o una promesa vieja se puso roja, eso es una regresión y va
primero.

## 4. Al usuario

Tres líneas: qué marca, qué significa, qué vas a tocar (o qué necesitas de él). La salida literal,
sin interpretarla, si te la pide o si es un 99 que no entiendes.
