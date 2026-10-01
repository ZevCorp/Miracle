---
name: sabotea
description: Automatiza el paso 5 del método — romper el código a propósito y comprobar que cada promesa se pone ROJA — con un plan de sabotajes reproducible, restauración garantizada y la tabla «Los sabotajes» lista para la spec y el PR. Úsala después de poner una promesa en verde, antes de /verifica, y siempre que el usuario diga "sabotea", "rómpelo a propósito", "comprueba que la promesa vale", "¿esta prueba detecta algo?", o cuando una promesa nació verde y hay que saber si vigila algo. Vale para Windows, Android, Mac, Graph y la raíz.
---

# Sabotear: la prueba de que la prueba prueba

Una promesa que solo se ha visto en verde no se distingue de una que siempre dice que sí. El
2026-09-30 el contrato de la raíz nació con 20 promesas en verde y, al sabotear, 7 seguían verdes.
El 2026-08-21 un sabotaje no llegó a aplicarse (CRLF) y su «verde» no probaba nada.

El script hace las comprobaciones que esos días faltaron: árbol limpio, ancla única, diff no vacío,
línea base, veredicto distinto de 99, y el archivo restaurado byte a byte aunque lo cortes con
Ctrl+C.

## 1. Commitea primero

El script se niega a sabotear archivos con cambios sin commitear. Un `wip` vale.

## 2. Escribe el plan

Un sabotaje por promesa: **el cambio mínimo que hace falso exactamente lo que dice su enunciado**.
Ideas que funcionan: invertir la condición, cambiar la constante que la promesa fija, borrar la
llamada que la cumple, devolver el valor de antes. Si no se te ocurre ninguno que la ponga roja, a
lo mejor la promesa no vigila nada.

Guárdalo junto a la spec, para que el rojo se pueda repetir: `<proyecto>/docs/specs/NNN-<slug>.sabotajes.json`.

```json
{
  "carpeta": "services/graph",
  "juez": "node scripts/contrato.js telemetria",
  "limite_s": 600,
  "sabotajes": [
    {"promesa": 108, "archivo": "src/application/use-cases/WindowsTelemetryService.js",
     "ancla": "const DIAS_DE_LOGS = 7;", "reemplazo": "const DIAS_DE_LOGS = 30;",
     "por_que": "la retención pasa de 7 a 30 días",
     "clausula": "opcional: un trozo del motivo que tiene que salir"}
  ]
}
```

- `ancla` es texto exacto que existe **una sola vez** en el archivo. Puede ser multilínea; si el
  archivo usa CRLF y el ancla viene con LF, el script la adapta.
- Añade un sabotaje de control cuando dudes de un juez: un cambio que la promesa **no** debería
  ver tiene que salir «SIGUIÓ VERDE».

## 3. El juez de cada proyecto

| Proyecto | `carpeta` | `juez` para iterar | Tarda |
|---|---|---|---|
| Graph | `services/graph` | `node scripts/contrato.js <trozo-del-verify>` | ~1 s |
| Android | `apps/android` | `./scripts/contrato.sh` | 1-2 min |
| Windows | `apps/windows` | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\contrato-del-grafo.ps1` (o `contrato-de-la-voz.ps1`) | 1-2 min |
| Mac (solo en macOS) | `apps/mac` | `./contrato.sh` | ~1 min |
| La raíz | `.` | `bash tools/monorepo/contrato.sh` | ~1 min |

Un juez parcial (`PARCIAL…`) vale para sabotear: lo que se mira es la línea de la promesa, no el
veredicto. El contrato entero se corre después, en `/verifica`.

## 4. Córrelo

```bash
python3 .claude/skills/sabotea/scripts/sabotea.py <proyecto>/docs/specs/NNN-<slug>.sabotajes.json
#   --solo 108,110        solo esos
#   --sin-linea-base      no correr el juez antes (si ya sabes que está verde y el juez es lento)
```

Primero corre el juez sin sabotear (la línea base): si la promesa ya estaba roja, su rojo no prueba
nada y lo dice.

## 5. Lee el resultado

| Sale | Qué significa | Qué haces |
|---|---|---|
| `✔ se puso roja` | la promesa vigila eso | nada |
| `✘ SIGUIÓ VERDE` | la promesa no ve ese cambio | o el sabotaje es malo, o **la promesa es débil**: reescribe la prueba (no el enunciado) y vuelve a sabotear |
| `✘ rompió el arnés (99)` | el código saboteado no compila o el juez no llegó a juzgar | busca un sabotaje que compile |
| `✘ no se aplicó` | el ancla no está, o está varias veces | hazla única |
| `también rojas: …` | el sabotaje rompió más promesas | normal si dependen; anótalo |
| `⚠ EL ARCHIVO NO QUEDÓ IGUAL` | no debería pasar nunca | para y mira `git diff` |

Sale con el número de sabotajes que **no** pusieron su promesa en rojo (0 = todos valen), o 99.

## 6. Llévalo a la spec y al PR

Pega la tabla `## Los sabotajes` en la sección del mismo nombre de la spec (las specs recientes de
Windows ya la tienen) y en el PR. En el commit:

```
test(<ámbito>): las promesas N-M se vieron rojas al sabotear su código

Sabotajes: K de K válidos (<proyecto>/docs/specs/NNN-<slug>.sabotajes.json).
```

Si alguna siguió verde, no se pasa a `/verifica`: se vuelve a `/promesas` con esa promesa.
