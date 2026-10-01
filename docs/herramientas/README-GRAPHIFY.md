# graphify en el equipo

[graphify](https://github.com/safishamsi/graphify) lee el código una vez y guarda un **mapa**: qué
clases y funciones hay, dónde están y quién usa a quién, con el archivo y la línea de cada uso.
Después se le pregunta al mapa en vez de leer el proyecto.

Esta guía dice para qué sirve de verdad aquí, que no es lo que promete su README. Se midió.

## Lo que se midió (2026-10-01)

Cuatro preguntas reales sobre `apps/windows`, cada una resuelta por un agente nuevo, con tres
configuraciones. «Trabajo» es lo que el agente tuvo que leer por encima de lo que carga al arrancar.

| Configuración | Trabajo | Tiempo |
|---|---|---|
| Sin graphify (grep y lectura) | 109.500 tokens | 129 s |
| graphify obligatorio antes de cada búsqueda (como estaba) | 124.700 tokens | 151 s |
| graphify solo donde gana, con el mapa al día | 106.600 tokens | 149 s |

Lo que salió de ahí, y es lo que gobierna todo lo demás:

1. **Preguntarle al mapa antes de cada búsqueda no ahorra nada.** Con un nombre exacto, grep ya es
   eficiente; el mapa solo añadía una llamada. Por eso se quitó el aviso «MANDATORY: run graphify
   first» que instala `graphify install`.
2. **Un mapa desfasado es peor que no tener mapa.** Dio una línea vieja (`FaceWindow` L4394 por
   L4475) y el agente tuvo que comprobarlo todo a mano. Los ganchos que trae graphify solo rehacen
   el mapa de la raíz, nunca tras un `git pull` y nunca dentro de un árbol de agente.
3. **Donde gana es en las relaciones:** quién depende de esto, a quién afecta mi cambio. Con grep
   eso es una cadena de búsquedas; con el mapa, una llamada.

Y eso último también se midió, con la pregunta «¿a quién afecta el commit `ff880743`?» (10 archivos
de Windows, 684 líneas), la misma para los tres y con la misma respuesta correcta:

| Cómo | Llamadas | Trabajo | Tiempo |
|---|---|---|---|
| Sin graphify: `git diff` y grep | 11 | 38.500 tokens | 57 s |
| `impacto.sh`, primera versión | 13 | 51.200 tokens | 51 s |
| `impacto.sh`, como está ahora | 1 | 1.500 tokens | 10 s |

La primera versión costó **más** que no usar nada, y por eso está en la tabla: repetía lo que dice el
mapa, y el mapa se equivoca de tres maneras que hubo que corregir (están en el contrato de la raíz,
promesas 41 a 43). Es una sola pregunta medida; léelo como una señal fuerte, no como una ley.

## Instalarlo (una vez por PC)

Desde la raíz del repo:

```powershell
powershell -ExecutionPolicy Bypass -File tools\graphify\instalar.ps1     # Windows
```

```bash
bash tools/graphify/instalar.sh                                           # Mac o Linux
```

Deja tres cosas hechas, y se puede repetir sin miedo:

- **uv y graphify, en la versión del equipo.** La versión está fijada en el script y es la misma del
  CI: con versiones distintas, dos personas dejan de ver el mismo mapa.
- **El portero activado** (`git config core.hooksPath .githooks`). Con él llegan los ganchos que
  rehacen el mapa.
- **El mapa de cada proyecto**, en `<proyecto>/graphify-out/`. Solo lee el código: no usa IA y no
  cuesta nada. En Windows se saltan los de Mac, y al revés.

`graphify-out/` no se versiona. Cada quien construye el suyo a partir del mismo código.

## El mapa se mantiene solo

Tras cada **commit**, **cambio de rama** y **`git pull`**, los ganchos del repo
(`.githooks/post-commit`, `post-checkout`, `post-merge`) llaman a `tools/graphify/refrescar.sh`, que
rehace en segundo plano el mapa de cada proyecto que ya lo tiene. Git no espera.

- **En un árbol de agente** (`tools/monorepo/arbol.sh nuevo`) el mapa se construye solo al crearlo,
  para los proyectos que tu clon principal tiene mapeados. `apps/windows` tarda unos 40 segundos.
- **No hay mapa de la raíz.** Uno de todo el monorepo tarda minutos y contesta peor que el del
  proyecto. Se trabaja desde la carpeta del proyecto, y ahí está su mapa.
- Qué hizo y cuándo: `~/.cache/graphify-rebuild.log`. Para apagarlo un momento: `GRAPHIFY_SKIP_HOOK=1`.
- Sin graphify instalado los ganchos no hacen nada: a quien no lo usa no le cambia nada.

## Para qué usarlo

### 1. A quién afecta tu rama

```bash
bash tools/graphify/impacto.sh
```

Mira las **líneas** que cambiaste contra `origin/main`, encuentra los símbolos que viven en ellas y
lista quién los llama o referencia desde fuera de tu cambio, con archivo y línea. Los documentos y
specs que los citan van aparte, para revisar si siguen diciendo la verdad.

```
### apps/windows

2 símbolo(s) cambiado(s) en 1 archivo(s) de código que ya existían. **1 archivo(s) de código de fuera dependen de ellos**, y 6 documento(s) los citan.

- `.DondeEstaSap()` (windows-client/src/Clinical/RellenadorSap.cs:64) ← 1 uso(s) en 1 archivo(s)
  - `windows-client/src/Clinical/EjecutorDeExportaciones.cs:220` — .AtenderAsync() (calls, inferido)
- `.RellenarConNotaAsync()` (windows-client/src/Clinical/RellenadorSap.cs:155) ← 1 uso(s) en 1 archivo(s)
  - `windows-client/src/Clinical/EjecutorDeExportaciones.cs:227` — .AtenderAsync() (calls, inferido)

**Documentos** que citan lo cambiado (revisa si siguen diciendo la verdad):
- `docs/specs/008-la-nota-llega-al-triage.md` — .RellenarConNotaAsync()
- la clase `RellenadorSap`, de la que cambió algún método, sale en 4: `docs/specs/004-…` y 3 más
```

Es la salida real de tocar esos dos métodos, y coincide con lo que se había contado a mano.

Tres cosas que hace a propósito, porque el mapa a secas se equivoca en ellas:

- **Deja fuera los archivos nuevos.** Nadie de fuera usa todavía lo que acaba de nacer; si el mapa
  dice que sí, confundió un nombre.
- **Avisa de las definiciones duplicadas.** Si dos clases tienen el mismo nombre completo —pasa con
  las sondas que declaran su propio `LogBus`—, graphify le cuelga todos los usos a una sola: el
  `LogBus` de verdad figuraba con cero y su copia con 348. `impacto` cuenta los de las dos y lo dice.
- **Solo el código hace viejo al mapa.** Tocar un `.md` después no dispara el aviso.

Cuándo correrlo: **antes de tocar algo compartido** (si la lista es larga, se avisa antes de abrir
la rama) y **antes del PR** (es el punto «cuántos sitios tocan lo que cambiaste», ya contado).

No hace falta acordarse en el PR: **cada PR recibe ese mismo informe como comentario**, y se
actualiza con cada push (`.github/workflows/graphify-impacto.yml`). Ahí no hay que instalar nada.
Es informativo: no bloquea el merge.

Lo que no dice: si algo se rompe. Dice quién usa lo que cambiaste; si sigue funcionando lo dicen el
contrato y la prueba. Y si no hay mapa, o es más viejo que tu código, lo dice en vez de callar.

### 2. Quién depende de una pieza

Dentro de la carpeta del proyecto (`cd apps/windows`):

```bash
graphify affected "RellenadorSap"       # quién la usa, hasta dos saltos
graphify explain "RellenadorSap"        # su ficha: dónde vive y con qué se conecta
graphify path "FaceWindow" "SapGuiSurface"   # cómo se llega de una a otra
```

### 3. Ubicarse en una zona que no conoces

```bash
graphify god-nodes --top 10             # las piezas con más conexiones: se tocan con cuidado
graphify query "cómo se reproduce un workflow en SAP"
```

`query` devuelve por dónde empezar, no la respuesta: después se lee el código. Si dice `TRUNCATED`,
la pregunta era demasiado ancha; hazla más concreta. Para verlo dibujado, abre
`graphify-out/graph.html` en el navegador.

### Cuándo no

Si ya tienes el nombre exacto de una clase, un método o un texto de log, **busca directo**. Es lo
que la medición dejó más claro.

## Para los agentes (Claude, Codex)

La regla está en `AGENTS.md` de la raíz (§Herramientas) y llega a todos: Codex lee ese archivo y
Claude recibe su copia. No hay que instalar la skill de graphify ni ningún gancho en
`settings.json`. Si tienes en tu `.claude/settings.local.json` el gancho `graphify hook-guard` de
antes, quítalo: es el aviso obligatorio que la medición mostró que no ayudaba.

## Si algo falla

| Lo que ves | Qué hacer |
|---|---|
| `graphify` no se reconoce | Abre una terminal nueva. Si sigue igual, corre otra vez el instalador. |
| `Missing expected target directory for Python minor version link` | Pasa al instalar desde la app de Claude en Windows, que desvía lo que se escribe en AppData. `instalar.ps1` lo detecta y saca a uv de AppData. |
| `impacto` dice «no hay mapa» | Ese proyecto no está mapeado en este árbol: `graphify update .` dentro de su carpeta. |
| `impacto` avisa de que el mapa es más viejo | Hay cambios sin commitear posteriores al mapa: `graphify update .` en el proyecto. |
| El mapa no se rehace tras un commit | `git config core.hooksPath` tiene que decir `.githooks`. Mira `~/.cache/graphify-rebuild.log`. |
| Algunos `.kt` salen como «skipped» | Es un fallo de graphify 0.9.71 con ciertos archivos Kotlin: los deja fuera del mapa. Lo demás del proyecto sí entra. |

## Qué no hacer

- No edites `graphify-out/` a mano ni lo commitees.
- No corras `graphify hook install`: instala ganchos en `.git/hooks`, que con el portero activado no
  se usan, y solo rehacían el mapa de la raíz. Los del repo ya lo cubren.
- No corras `graphify extract` sin querer: esa sí usa IA y gasta saldo. Para el código basta
  `graphify update .`.
