---
name: commit
description: Escribe el mensaje de commit (y el título del PR) en la voz del repo — «tipo(ámbito) y lo que el sistema ahora hace», en español y en minúscula, con el cuerpo que lleva la medida (promesas en verde, recuento del contrato, en cuántos sitios vivía la clase de error, dónde se probó) — leyendo del diff qué toca y qué promesas añade, y revisando que no se cuele nada que no se commitea. Úsala cada vez que haya que commitear o titular un PR, cuando el usuario diga "commitea", "haz el commit", "ponle mensaje", "cómo lo titulo", "reescribe el mensaje", o al cerrar una fase de /implementa.
---

# El mensaje de commit

El repo tiene una voz, y se sostiene: el historial se lee como lo que el sistema fue aprendiendo a
hacer. Commitear lo pide el usuario (o una skill que él invocó, como `/implementa`); esta skill es el
cómo.

## 1. Mira lo que va

```bash
git status --short
python3 .claude/skills/commit/scripts/contexto.py          # lo que está en el índice
python3 .claude/skills/commit/scripts/contexto.py --todo   # si aún no hiciste git add
```

Te dice los ámbitos que toca, un tipo sugerido, **las promesas que el diff añade** (con su texto),
si toca specs, migraciones o la forma del turno, y lo que no debería ir (`.env`, `.jks`, `bin/`,
`out/`, `node_modules/`, binarios). Añade con rutas concretas, no `git add -A` en una carpeta que
pueda tener cosas de otros (`.claude/rules/solo-mac.md`: cada máquina toca su lado).

## 2. El asunto

```
tipo(ámbito): lo que el sistema ahora hace
```

- **Tipos**: `feat` (hace algo nuevo), `fix` (deja de hacer algo mal), `test` (promesas escritas
  antes que su código), `docs`, `chore` (sin cambio de comportamiento), `wip` (hasta donde llegué),
  `perf` (lo mismo, más rápido, medido).
- **Ámbito**: el proyecto o el módulo — `graph`, `web`, `android`, `mac`, `monorepo`, y en Windows
  el módulo: `voz`, `notch`, `carita`, `actualizacion`, `sap`, `nucleo`, `plata`, `bronce`…
- **El resultado, no la edición.** Dice qué hace el sistema ahora, en español, en minúscula y sin
  punto final. Si termina algo malo, lo nombra: «y se acaba el segundo cálculo», «deja de llenarse».
- Spec y promesas al final, entre paréntesis, cuando las hay: `(spec 075, promesas 660 a 667)`.

| Mal | Bien |
|---|---|
| `feat(plata): añadir método Derivar` | `feat(plata): el mobiliario derivado abre rutas, y se acaba el segundo cálculo` |
| `fix: arreglar bug de la voz` | `fix(voz): apagar no espera a la red, y un clic entre medias ya no hace lo contrario` |
| `Update WindowsTelemetryService.js` | `feat(graph): los logs de Ü Windows se juntan al entrar y caducan a los 7 días, y la base deja de llenarse` |
| `test: tests nuevos` | `test(graph): las promesas de la telemetría, escritas antes que su código` |

## 3. El cuerpo: la medida

Lo que hace bueno un mensaje de este repo es el número. Lo que va, si aplica:

```
Promesa 643 en verde (un token rechazado se reintenta sin token). Contrato: 395/395, 0 pendientes.
La clase de error vivía en 8 sitios (5 en ConversacionEnVivo, 3 en LiveAudio); los 8 corregidos.
Probado en explorer.exe y Configuración — 2 pantallas, no 1.
Sabotajes: 8 de 8 se pusieron rojas (docs/specs/075-….sabotajes.json).
```

- El recuento del contrato es el de **la última corrida del juez**, no uno recordado ni estimado. Si
  no lo corriste, no lo pongas: di «sin juzgar en esta máquina».
- El número de sitios sale de buscarlos (`/clase-de-error`, o `higiene.py --todo --clase …`).
- Lo que no se probó, se dice («el collar y la salida por parlantes no se midieron»).
- Viñetas cortas para un commit que hace varias cosas, cada una con su porqué en la misma línea.
- Cierra con el `Co-Authored-By` que te indique tu entorno, si te indica uno.

## 4. Commitear

```bash
git commit -F- <<'EOF'
feat(graph): …

Promesa …
EOF
```

`-F-` con heredoc para que las tildes, los `«»` y las comillas lleguen intactos. Nunca `--amend` ni
`--no-verify` sobre trabajo empujado o compartido. En el método, el rojo se commitea antes que el
verde (`test(...)` y después `feat(...)`): es el registro de que la prueba no se escribió para pasar.

## 5. El título del PR

El del commit squash, igual de largo y en la misma voz, con el número de PR que GitHub añade solo
al mergear. El cuerpo del PR sale de su plantilla (`.github/pull_request_template.md`) y es cosa de
`/a-main`.
