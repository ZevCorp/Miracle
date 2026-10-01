# Ü para Mac — guía para trabajar en `apps/mac`

El cliente nativo de Ü para macOS, en Swift y AppKit: lee y acciona controles por accesibilidad
(AX), captura la pantalla cuando Graph la pide y habla por la voz en vivo. Qué hace y cómo se
instala está en el [`README.md`](README.md). Las reglas comunes del monorepo (ramas, commits, qué
toca cada máquina) están en el [`AGENTS.md`](../../AGENTS.md) de la raíz.

**Solo se compila en macOS.** Desde Windows o Linux no se toca `Sources/` ni `Tests/`: no hay cómo
verificarlo. Todos los comandos de aquí se corren desde esta carpeta (`cd apps/mac`).

## El ciclo

Es el del monorepo ([`docs/monorepo/metodo.md`](../../docs/monorepo/metodo.md)), con las
herramientas de la Mac:

```
1.  rama <persona>/<que-hace> desde main fresco
2.  la spec:      docs/specs/NNN-<slug>.md, con la tabla «| # | Promesa | Juez |»
3.  la promesa:   una función test… en Tests/UCoreTests/, llamada desde ContractRunner.swift,
                  y verla ROJA
4.  el código, hasta que salga verde
5.  ROMPE el código a propósito: si la promesa no se pone roja, no vale nada
6.  pruébalo en la app INSTALADA (./instalar.sh), no en el ejecutable suelto
7.  git push: el portero decide
8.  PR con la evidencia → squash merge
```

| Qué | Dónde |
|---|---|
| Specs | `docs/specs/NNN-*.md`. La spec NNN numera sus promesas desde NNN×100+1 |
| Promesas | `Tests/UCoreTests/*.swift`: una función `test…` por fila, y su llamada en `ContractRunner.swift` |
| El juez | `./contrato.sh` → `CONTRATO INTACTO: N promesas.` |
| El cruce, sin Swift | `./contrato.sh --cruce`: specs, tests y corredor cuadran. Corre en cualquier máquina |
| El portero | `.githooks/pre-push`: compila, contrato intacto, y la rama que cambia `Sources/` trae su test |
| El CI | [`mac-build.yml`](../../.github/workflows/mac-build.yml), en macOS: el contrato y la app empaquetada |
| Lo heredado | [`docs/specs/000-lo-heredado.md`](docs/specs/000-lo-heredado.md): los 31 contratos que ya había |

Al añadir un test hay que tocar tres sitios, y el juez no deja olvidar ninguno: la función, su
llamada en `ContractRunner.swift` (con el recuento de su línea `PASS`) y su fila en la spec.

## Compilar y correr

```bash
./contrato.sh           # el contrato: sin red, sin micrófono, sin escritorio
./build.sh release      # contratos y la app empaquetada en .artifacts/
./instalar.sh           # la copia a ~/Applications, que es la que hay que probar
./abrir.sh
```

## Lo que hay que saber antes de tocar

- **El corredor se detiene en la primera aserción que falla.** El juez dice cuál fue y cuántas
  quedaron sin juzgar detrás; no se dan por buenas.
- **macOS registra los permisos (TCC) por bundle y por firma.** Probar el ejecutable suelto, o
  alternar entre copias, da resultados que no se repiten en la app instalada. El detalle está en el
  README.
- **La paridad con Windows se mide, no se declara.** `migration/verify.py` guarda la evidencia de
  cada capacidad, y ninguna cuenta como migrada por existir su archivo
  ([`migration/STATUS.md`](migration/STATUS.md)).
- **No se copia código de Windows.** Se copia el comportamiento y su porqué, y se reescribe en
  Swift.
- **Releases de GitHub: no.** La Mac publica artefactos de CI. Las releases del repo son de Windows.
