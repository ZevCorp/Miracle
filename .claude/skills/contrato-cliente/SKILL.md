---
name: contrato-cliente
description: Protege la costura entre Graph y sus tres clientes (Windows, Android, Mac) — compara campo por campo lo que Graph manda y lee en POST /api/v1/agent/turn con lo que cada cliente lee y manda, y obliga a cambiar los cuatro lados en la misma rama. Úsala cuando un diff toque AgentTurnService, conscious-brain/, registerWindowsAgentRoutes, Protocol.cs, TurnProtocol.kt o Protocol.swift, cuando se añada o renombre un campo del turno o una acción, o cuando el usuario diga "agrega un campo a la respuesta", "el cliente no recibe X", "cambia el protocolo", "la acción nueva".
---

# La costura de los cuatro lados

`POST /api/v1/agent/turn` es «SAGRADO» (lo dice la cabecera de `AgentTurnService.js`): Graph decide,
los clientes ejecutan, y cada uno lleva escrita la forma del JSON. Graph se despliega solo al
mergear; los clientes, cuando el usuario actualiza. Un campo renombrado en Graph deja a los clientes
leyendo vacío **en silencio**: nada falla, simplemente deja de funcionar.

| Lado | Archivo | Estructuras |
|---|---|---|
| Graph | `services/graph/src/application/use-cases/AgentTurnService.js`, `src/infrastructure/conscious-brain/{openaiBrain,geminiBrain,prompt}.js` | el turno, las acciones |
| Windows | `apps/windows/windows-client/src/Domain/Protocol.cs` (`[JsonPropertyName]`) | `TurnRequest`, `ScreenState`, `AgentAction`, `TurnResponse` |
| Android | `apps/android/core/src/commonMain/kotlin/graph/core/graph/TurnProtocol.kt` | `TurnRequest`, `TurnScreenState`, `TurnAction`, `TurnResponse` |
| Mac | `apps/mac/Sources/UCore/Protocol.swift` (`CodingKeys`) | las mismas que Windows |

## 1. Medir antes de tocar

```bash
python3 .claude/skills/contrato-cliente/scripts/campos.py                  # el árbol de trabajo
python3 .claude/skills/contrato-cliente/scripts/campos.py --ref origin/main # cómo estaba en main
```

Da una tabla por estructura y marca:
- **✘ un cliente lee lo que Graph no manda** (le llega vacío), o **Graph lee lo que un cliente no
  manda** (esa función no existe en ese cliente);
- **·** lo que se manda y nadie lee (peso muerto, o una función a medias).

Compara la salida de `--ref origin/main` con la de tu rama: **la diferencia es tu cambio de
forma**. Si no hay diferencia, no tocaste la costura y aquí termina la skill.

Deriva que ya existía el 2026-10-01 (no es tuya, pero no la empeores): Windows lee `memory` y
`memoryId`, que vienen del backend viejo y Graph no manda; Windows manda `timezone`, `locale` y
`clientNowUtc`, y Mac `userContext` y `platform`, que Graph no lee.

Lo que el script **no** ve (es lectura de código): un campo armado con spread u `Object.assign`, y
el segundo salto de Android — `TurnResponse` se convierte en `BrainTurn` (`toBrainTurn()` en
`TurnProtocol.kt`, `BrainTurn` en `core/…/domain/Ports.kt`), y un campo que no pasa por ahí no le
llega al motor aunque la tabla salga limpia.

## 2. Cambiar la forma, los cuatro lados en la misma rama

1. **Añadir es seguro; renombrar o quitar, no.** Para renombrar: manda los dos nombres un tiempo,
   cambia los clientes, y quita el viejo en otra rama cuando las versiones instaladas lo tengan.
2. **Opcional en los clientes**: el campo nuevo se lee como opcional (`double?`, `Double? = null`,
   `decodeIfPresent`), porque Graph se despliega antes de que los clientes se actualicen y al revés.
   Un `double` sin `?` vale 0 cuando el campo no viene: el cliente actuaría como si Graph hubiera
   mandado 0. Los tres clientes ya ignoran claves desconocidas (System.Text.Json por defecto,
   `ignoreUnknownKeys = true` en `TurnJson`, `CodingKeys` en Swift): **añadir en Graph no rompe a
   nadie instalado**. Dónde se toca en cada uno:
   - Windows: la propiedad con `[JsonPropertyName]` en `TurnResponse`, y quien la usa (`Agent/AgentLoop.cs`).
   - Android: `TurnResponse` **y** `toBrainTurn()` **y** `BrainTurn` (Ports.kt), y el motor (`application/Engine.kt`).
   - Mac: cuatro sitios en `TurnResponse` (la propiedad, el caso de `CodingKeys`, el `decodeIfPresent`
     y el `init` público que usan los tests), y `AgentEngine.swift`.
   - Graph: la clave en el `const turn = {…}` de **los dos** cerebros (`openaiBrain.js` y
     `geminiBrain.js`), o en el `json: {…}` de `AgentTurnService` si no depende del proveedor.
3. **La plataforma**: `X-Miracle-App: android_app` cambia el prompt y el catálogo. Un campo que solo
   tiene sentido en una plataforma se dice en la spec; los demás clientes lo ignoran, no lo leen.
4. **Producción**: hasta el corte (`docs/monorepo/despliegue.md`) los clientes instalados hablan con
   `graph-eight-pied`, que sale del repo viejo. Mergear a `main` despliega `miracle-graph`, que aún no
   usa nadie: un campo nuevo no le llega a ningún usuario hasta el corte, o hasta portarlo a
   `joseph1356k/Graph`. Dilo en el plan.
5. **Las promesas**: en Graph, la 2 fija la respuesta a Windows byte a byte
   (`scripts/verify-agent-platform.js`, contra `tests/fixtures/agent-platform/windows-snapshot.json`)
   y la 3 y la 4 el resto. **No regeneres el fixture para «arreglar» un rojo**: su cabecera lo
   prohíbe. Si la forma cambia a propósito, es una promesa nueva en la spec, y el cambio del
   fixture va en ese commit, explicado.
6. **Cada cliente con su promesa**: Windows en `Contrato.cs`, Android en
   `core/src/commonTest/…/contrato/`, Mac en `Tests/UCoreTests/` (con su llamada en
   `ContractRunner.swift`). El portero de cada proyecto exige que la rama traiga la suya.

## 3. Comprobar

- `campos.py` sin ✘ nuevos respecto a main.
- `cd services/graph && npm test`: las promesas 2, 3 y 4 en verde.
- `/antes-del-push`: la rama toca hasta cuatro proyectos y pasa los cuatro porteros. Desde una
  máquina que no compila Windows o Mac, su juez lo corre el CI del PR: dilo en el PR.

Una feature que cruza proyectos es **una sola rama y un solo PR** (regla 5 del monorepo).
