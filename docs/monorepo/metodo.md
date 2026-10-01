# El método: la promesa antes que el código, en todos los proyectos

Aplicado el 2026-09-30. Hasta ese día el método era de Windows y de Android; Mac, Graph y el portal
tenían tests, pero nada exigía que una rama trajera su promesa. Este documento dice qué es igual en
todos los proyectos y qué cambia de uno a otro. El detalle de cada proyecto está en su `AGENTS.md`.

## La regla

**Ninguna línea de producción entra antes que la promesa que la juzga.** Una prueba escrita después
del código se escribe para que pase.

## El ciclo

```
1.  tu árbol:     bash tools/monorepo/arbol.sh nuevo <persona>/<que-hace>     ← rama y árbol propios
2.  la spec:      <proyecto>/docs/specs/NNN-<slug>.md, con sus promesas numeradas
3.  la promesa:   escrita en el contrato del proyecto, y vista en ROJO
4.  el código, hasta que salga verde
5.  ROMPE el código a propósito: si la promesa no se pone roja, no vale nada
6.  pruébalo de verdad: en el PC, en el teléfono, contra el servidor en marcha
7.  git push: el portero decide
8.  PR con la evidencia → la compuerta en verde → squash merge
9.  cierra:       bash tools/monorepo/arbol.sh cerrar                        ← borra el árbol y la rama
```

Los pasos que más se saltan son el 3, el 5 y el 6. El 5 no es ceremonia: el 2026-09-30 el contrato
de la raíz nació con veinte promesas en verde, y al sabotear las herramientas siete seguían verdes.
El arnés tenía un fallo que solo el sabotaje enseñó.

## Lo que es igual en todos

| Pieza | Qué es |
|---|---|
| **La spec** | `<proyecto>/docs/specs/NNN-<slug>.md`, con una tabla de promesas. Cada promesa es una frase en presente, falsa hoy y verdadera después, que no nombra la implementación |
| **El juez** | un comando por proyecto que corre todas las promesas y termina con una de tres líneas |
| **El portero** | `<proyecto>/.githooks/pre-push`, al que llama el despachador de la raíz cuando la rama toca el proyecto |
| **El CI** | corre el mismo juez en el PR, llamado por la compuerta (`monorepo.yml`) |

**Los tres veredictos del juez**, siempre en su última línea:

```
CONTRATO INTACTO: N promesas.
CONTRATO ROTO: M promesa(s) incumplida(s). El cambio no puede entrar así.
NO SE PUDO JUZGAR: …
```

El tercero sale con código 99 y no es un rojo de las promesas: el juez no llegó a juzgar (no
compila, falta una dependencia, una promesa sin pareja). Un «no sé» no se presenta como recuento.
Cuentan como incumplidas la promesa pendiente (escrita, sin código todavía) y la promesa sin juez
(está en la spec y nada la juzga).

**Las cuatro comprobaciones del portero:**

| | Qué exige |
|---|---|
| 0 | a `main` no se empuja directo |
| 1 | compila |
| 2 | el contrato está intacto |
| 3 | la rama trae su propia promesa: si cambia código y no toca el contrato, no pasa |

De la 3 quedan exentas `chore/`, `docs/`, `refactor/` y `hotfix/`, que por definición no añaden
comportamiento. En Android la exención solo vale si además la rama no toca código.

## El método en cada proyecto

| | Windows | Android | Mac | Graph |
|---|---|---|---|---|
| Carpeta | `apps/windows` | `apps/android` | `apps/mac` | `services/graph` |
| Promesas | `tests/ContratoDelGrafo/Contrato.cs` y `voz/Contrato/` | `core/src/*Test/…/contrato/` | `Tests/UCoreTests/` | `scripts/verify-*.js` |
| Juez | `scripts\contrato-del-grafo.ps1` y `contrato-de-la-voz.ps1` | `./scripts/contrato.sh` | `./contrato.sh` | `npm test` |
| Numeración | continua, la de siempre | la spec NNN desde NNN×100+1 | igual que Android | igual que Android |
| Portero | compila en Release y juzga | compila en release y juzga | en macOS, compila y juzga; fuera, solo el cruce | juzga (~5 s) |
| CI | `windows-contrato.yml` | `android-apk.yml` | `mac-build.yml` | `graph-ci.yml` |
| La prueba de verdad | `U.exe` en ≥2 pantallas, con el log | el APK en el teléfono, en 2 apps | la app instalada | el servidor en marcha, una llamada real |

El portal (`apps/web`) queda fuera de este método por decisión del dueño: tiene su CI (lint,
typecheck, tests y build) y la compuerta lo exige igual, pero no numera promesas.

Lo heredado no se reescribió. Graph y Mac registraron lo que ya juzgaban en
`docs/specs/000-lo-heredado.md`, una fila por verificación, y desde ahí el juez exige que cada fila
tenga juez y cada juez tenga fila. Solo el trabajo nuevo entra con spec primero.

## La compuerta

`main` exige un solo check: `compuerta`, de [`monorepo.yml`](../../.github/workflows/monorepo.yml).
Corre en todos los PRs, mira qué proyectos toca el PR y llama al CI de cada uno. Un proyecto que el
PR no toca sale «skipped», y eso cuenta como verde.

Es una sola porque un workflow con filtro de rutas que no llega a correr deja su check pendiente
para siempre, y con `main` protegido eso bloquearía cualquier PR que no toque ese proyecto.

## Un agente, un árbol

Dos agentes no comparten árbol de trabajo, igual que dos personas no comparten rama. El `git switch`
de uno le cambia la rama al otro, y un `git add -A` se lleva los cambios ajenos a su commit.

```bash
bash tools/monorepo/arbol.sh nuevo jose/lo-que-sea   # la rama, desde main fresco, en su propio árbol
bash tools/monorepo/arbol.sh estado                  # quién está en qué árbol
bash tools/monorepo/arbol.sh cerrar                  # terminé: borra mi árbol y mi rama
bash tools/monorepo/arbol.sh limpiar                 # cierra todo lo terminado que nadie usa
```

- **El guardia.** Un árbol es de la primera sesión de agente que escribe en él. Otra sesión que
  intente editarlo o commitear en él se detiene, con la orden para crear el suyo. La marca caduca a
  las 4 horas sin actividad, y `arbol.sh tomar` la pasa a quien viene a seguir ese trabajo. A una
  persona en su terminal no la toca.
- **Cerrar no tira trabajo.** Solo se borra lo que ya está en `main` (su PR está mergeado, o la rama
  no tiene commits propios) y no tiene cambios sin commitear. Lo demás se nombra y se deja.
- **Dónde se crean:** en `git config u.arboles`, y si no está puesto, junto al clon, en
  `<clon>-arboles/`. Fuera del clon a propósito.
- **Claude Code** entra a su árbol con la herramienta `EnterWorktree` (`path`). El gancho que avisa
  antes de cada edición está en el `.claude/settings.json` de la raíz y de cada proyecto, porque
  Claude no hereda ganchos entre carpetas.

GitHub borra la rama remota al mergear el PR. `arbol.sh cerrar` borra lo que queda en el disco.

## Cuándo no aplica

El método cuesta media hora larga, y no se paga por todo. Textos, colores, renombrados y
documentación van directos, en una rama `chore/` o `docs/`. La prueba de si aplica: **¿se puede
escribir la frase que hoy es falsa y después será verdadera?** Si sí, esa frase es una promesa.

## Añadir el método a un proyecto nuevo

1. `docs/specs/` con su plantilla, y el inventario de lo que ya se juzga, si lo hay.
2. Un juez que termine con uno de los tres veredictos y salga con 0, con el número de incumplidas
   o con 99.
3. `<proyecto>/.githooks/pre-push`: declara qué es código, qué es promesa y cómo se juzga, y carga
   `tools/monorepo/portero.sh`. El de Graph es el ejemplo más corto.
4. Su workflow, con `workflow_call`, y su trabajo en la compuerta.
5. Su `AGENTS.md`, con el ciclo y sus comandos, y un `CLAUDE.md` cuya primera línea sea
   `@AGENTS.md`.
6. Su `.claude/settings.json`, con el gancho del guardia de árboles.

## Lo que se midió

- **Graph:** 34 verificaciones en ~5 s, cuatro a la vez. En el `npm test` de antes iban en fila.
  Una (la 22) necesita Postgres y nunca se había juzgado en CI: su script salía con 0 al saltarse.
  Ahora el veredicto la nombra como sin juzgar.
- **El portero de Graph**, con un sabotaje sin commitear: juzgó el commit en un árbol temporal y dio
  verde, que es lo correcto. Con el sabotaje commiteado dio rojo en la promesa 5.
- **El juez de Mac**, con un `swift` simulado en Windows: un corredor que sale con 0 sin escribir
  su `PASS` no cuenta como intacto. La corrida real es la de su CI en macOS.
- **Las skills de la raíz** cargan en una sesión abierta en cualquier subcarpeta. Los ganchos no:
  solo los de la carpeta donde se abre la sesión. Medido con Claude Code 2.1.276.
