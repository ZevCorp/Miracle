# Plan de implementación: la meta vive hasta cumplirse — tareas largas que no se sueltan a medias

Estado: **en curso** · Nace de la petición del dueño del 2026-10-01 · Rama: `jose/la-voz-conversa-y-aprende`
· Sobre la 081 (las manos rápidas) y la 073 (el delegado y los avances)

> «No siento la confianza como usuario todavía para entregarle tareas complejas largas. […] Debería ser una meta
> completa, que entre los dos tengan una sincronicidad muy bien alineada […] creo que quizás no le entrega contexto
> al planificador de lo que el ejecutor ya ejecutó en los últimos clics y en toda la ejecución que lleva. […]
> Quiero sobre todo implementar algo que ya otra empresa haya implementado, como OpenAI, que lo tengan listo en
> producción y que esté validado. […] En esta etapa vamos a tener esa medición [350 ms por ciclo de clic] más una
> medición de cuántos objetivos complejos largos logró con éxito.» — el dueño, 2026-10-01.

## Qué hace OpenAI en producción, y qué se copia

Leído el 2026-10-01 del harness de Codex (`openai/codex`, `codex-rs`), que es el mismo que sirve su Agents API, y
de sus guías (las fuentes, al final):

| Lo que hacen | Dónde | Lo que significa para Ü |
|---|---|---|
| **Un solo modelo en bucle**, sin planificador aparte; `update_plan` es una lista visible que no ejecuta nada | el bucle del agente | quien planea ya ES ese modelo, y `map_hacer` ya es su lote de acciones (`computer_call.actions`). No se añade un segundo planificador. |
| **Meta persistente**: `create_goal`, `get_goal`, `update_goal` con `complete`, `blocked`, `paused` | `ext/goal/src/spec.rs` | la meta existe fuera del turno: no se acaba porque el modelo deje de pedir herramientas |
| **Continuación sola**: al acabar un turno con la meta activa, arranca otro con el objetivo íntegro | `ext/goal/src/runtime.rs` (`continue_if_idle`), `templates/goals/continuation.md` | lo mismo: si quien actúa termina sin cerrar la meta, Ü le devuelve el trabajo |
| **Chequeo de progreso** y **auditoría de terminado**, requisito por requisito, contra el estado real | la misma plantilla | terminar es una afirmación con evidencia de lo que se ve AHORA, no «se acabaron los pasos» |
| **Bloqueada solo tras tres turnos** con el mismo bloqueo | la misma plantilla | rendirse a la primera no es una salida |
| **Corregir en caliente** (`turn/steer`): lo que dice el usuario entra en el trabajo vivo; parar es otra orden | `app-server-protocol/.../turn.rs`, `core/src/session/input_queue.rs` | lo que la persona diga mientras hay meta le llega a quien actúa CON la meta delante |
| El lento entra **por eventos** —fin de tramo, falta de progreso, entrada nueva—, no por reloj | plantilla y `guardian-v2` | un supervisor «cada 10 s» no existe en ningún sistema en producción que se haya encontrado |

**De HRM** (arXiv 2506.21734) se queda lo que el análisis de ARC Prize midió que pesa: no la jerarquía (≈5 puntos
frente a un transformer igual), sino el bucle de fuera —hago, ¿terminé?, refino— (+13 con un solo refinamiento).
Es exactamente la continuación con auditoría. Y Agent S3 midió que un gestor con subobjetivos viejos empeora
(48,8 → 62,6 % de éxito y −62 % de tiempo al quitarlo).

**Lo que la hipótesis del dueño sí acierta, y entra:** la meta es UNA y vive entera con quien ejecuta; quien planea
recibe TODO lo ejecutado —también cada clic de las manos dentro de un objetivo, que hoy no le llega—; y se corrige
sin parar.

## El encargo, como se mide su final

Dos medidas, las dos sobre la Ü de pruebas con `scripts/nivel4-voz/por-ordenes/banco.py`:

| | Antes | Meta |
|---|---|---|
| Milisegundos por ciclo de clic (ver, pulsar, volver a ver), mediana | por nombre exacto 357; nombre inventado 1.260; objetivo de las manos 400–800 | ≤ 450 en todos los caminos |
| Metas largas logradas, de las del banco | se mide al empezar (línea base) | todas, tres corridas seguidas |

## El diseño, en seis frases

1. **Una meta se crea para lo largo** —varias partes, una duración, una investigación, «hasta que…»—, con el
   objetivo dicho entero. Lo corto sigue como hoy, sin meta.
2. **Mientras la meta esté activa, el trabajo no se suelta**: si quien actúa termina su turno sin cerrarla, Ü le
   devuelve el objetivo íntegro, la bitácora de lo hecho, el chequeo de progreso y la auditoría de terminado.
3. **Cerrar es afirmar con evidencia**: «cumplida» pide lo que se ve AHORA que lo prueba; «bloqueada» no se
   acepta antes del tercer turno; «pausada», solo si la persona lo pide.
4. **La bitácora lleva todo lo ejecutado**: cada llamada con cómo salió, cada paso de cada plan y cada clic que
   las manos dieron dentro de un objetivo, con su nombre.
5. **Lo que la persona dice con una meta activa viaja con la meta**: quien actúa recibe, junto al pedido, el
   objetivo y la bitácora, y decide si es una corrección, otra cosa, o parar.
6. **Tiene techo**: un máximo de continuaciones y de minutos; al llegar, se pausa y lo dice.

## La especificación

En el contrato del grafo:

| # | Promesa |
|---|---|
| 795 | una meta nace con su objetivo entero y vive fuera del turno: solo puede haber una sin cerrar, y verla dice el objetivo, su estado, los turnos, las acciones y el tiempo que lleva |
| 796 | cerrar una meta es afirmar con evidencia: «cumplida» sin decir qué se ve que lo prueba no se acepta; «bloqueada» no se acepta antes del tercer turno de la meta; «pausada» sí, y las tres dejan la meta cerrada con su cuenta |
| 797 | la bitácora de la meta lleva todo lo ejecutado, en orden y con cómo salió: cada llamada, cada paso de un plan y cada clic de las manos dentro de un objetivo; cabe siempre —lo viejo se cuenta en vez de listarse— y un paso no ejecutado deja su rastro |
| 798 | si quien actúa termina su turno con la meta activa, Ü le devuelve el trabajo: la continuación lleva el objetivo íntegro, la bitácora, el chequeo de progreso y la auditoría de terminado; una meta cerrada no continúa, y pasado el techo de continuaciones o de minutos se pausa diciéndolo |
| 799 | lo que la persona dice con una meta activa viaja con la meta: antes del pedido va un mensaje con el objetivo y la bitácora, marcado como no dicho por ella; sin meta no viaja nada |
| 800 | quien actúa tiene las tres herramientas de la meta, y sus instrucciones dicen cuándo crearla y que el trabajo no se suelta hasta cerrarla; y el relato de un objetivo cumplido por las manos dice qué pulsaron |
| 801 | lo que quedó pedido y sin contestar en el hilo no se retoma solo: el hilo viaja como contexto de antes, y dice que solo se hace lo que la persona pide ahora salvo que lo vuelva a pedir |

En el contrato de la voz:

| # | Promesa |
|---|---|
| 72 | lo que quien actúa tiene que saber y la persona no dijo viaja como un mensaje en la conversación, sin pedir turno; vacío no se manda nada, y un protocolo de una sola voz no manda nada |

### Con qué se juzga cada una

- **795–798**: la clase `LaMeta`, pura, con el reloj inyectado.
- **799, 800**: el catálogo, las instrucciones y el cableado leídos de la fuente; el mensaje, del protocolo (72).
- Que la meta de verdad se cumpla: el banco.

## Las fases

| Fase | Pone verde | Toca |
|---|---|---|
| 1 | 795, 796, 797 | nuevo `Voice/LaMeta.cs` |
| 2 | 798, 799 | `ConversacionEnVivo.cs`, `ProtocoloGptLive.cs`, `IProtocolo.cs` |
| 3 | 800 | `ConversacionEnVivo.cs` (catálogo, despacho, instrucciones), `u/Nucleo/Ejecutor.cs` |
| 4 | — (el banco) | nuevo `scripts/nivel4-voz/por-ordenes/banco.py` |

## Lo que NO entra

- **Un supervisor por reloj** que mire a las manos cada tantos segundos: no está en producción en ningún sitio
  encontrado, y lo medido (Agent S3) va en contra. Si el banco muestra objetivos de las manos que se desvían sin
  que nadie lo note, se vuelve aquí con ese dato.
- **Llamadas asíncronas** (`async: true`): existen en Responses para otros modelos; no se encontró que valgan en
  la delegación de GPT-Live ni con `gpt-6-luna`.
- **Varios agentes a la vez**: la guía de OpenAI pide uno solo cuando cada paso depende del anterior, que es
  operar una pantalla.

## Fuentes

- `openai/codex` · `codex-rs/ext/goal/src/spec.rs`, `runtime.rs`, `templates/goals/continuation.md`,
  `templates/goals/objective_updated.md` · `codex-rs/core/src/tools/handlers/plan_spec.rs` ·
  `codex-rs/app-server-protocol/src/protocol/v2/turn.rs` · `codex-rs/core/src/session/input_queue.rs` ·
  `codex-rs/ext/guardian-v2/src/async_scorer/`
- developers.openai.com: `guides/agents-api/architecture`, `guides/agents-api/sessions`, `guides/live-delegation`,
  `guides/tools-computer-use`, `guides/responses-multi-agent`, `guides/async-tool-calling`
- HRM: arxiv.org/abs/2506.21734 · arcprize.org/blog/hrm-analysis · Agent S3: arxiv.org/abs/2510.02250

## Hallazgos

Medido el 2026-10-01 con `banco.py` sobre la Ü de pruebas, contra el servidor real.

**La meta se continúa sola** (corrida `c1`). Se le pidió crear la meta y terminar el turno sin hacer nada: a los
2 s Ü le devolvió el trabajo («meta: continúa … turno 2»), quien actúa abrió la calculadora, hizo la cuenta y la
cerró con evidencia (12 × 12 = 144), 24 s en total. Es el camino entero: la continuación entra en la conversación,
la nota hace que la voz delegue otra vez, y el delegado lee el objetivo y la bitácora.

**Metas logradas** (cada una juzgada por lo que queda en la respuesta o en el disco, no por lo que Ü diga):

| Corrida | Logradas | Qué pasó con las demás |
|---|---|---|
| `m4` | 2 de 5 (las dos de calculadora) | 3 no terminaron: no llegaron a abrir sesión, la red de la máquina cayó («Host desconocido: api.openai.com»); 1 cortada |
| `m6` | 3 de 3 (Configuración, carpetas, Wikipedia) | la investigación, cortada por el vigilante: abrió la búsqueda en el Edge de la persona |
| `f1` | 1 de 1 (Configuración) | 2 cortadas (una Calculadora y el Chrome de la persona pasaron al frente); se paró ahí: la persona estaba usando el PC |

Dos de ellas con meta creada y cerrada con evidencia: Configuración (11 acciones, 31 s) y Wikipedia (20 acciones,
65 s). La investigación en Google —la larga de verdad— **no tiene todavía una corrida completa**.

**Lo que apareció midiendo, y entró:**

1. **Un pedido viejo sin contestar se retomaba solo** (801). Con el hilo guardado diciendo «continúa naturalmente
   desde aquí», quien actúa terminó lo pedido y se puso con un pedido de dos órdenes atrás. Lo que no se suelta es
   una meta activa; un pedido viejo es contexto.
2. **La voz comentaba la foto del pedido** (73 de la voz). Con música en la pantalla dijo «¿Te pongo otra canción
   de las que tienes por acá?». La foto dice ahora que es de quien actúa. Falta medirlo con el micrófono.
3. **La meta se creaba para dos datos sueltos**: dos llamadas de más (≈4 s de 38). Las instrucciones dicen ahora
   «más de tres partes» y que lo corto no la lleva.
4. **El relato con lo pulsado sirve**: dos veces las manos fueron a otro sitio, y quien planea lo corrigió en la
   vuelta siguiente porque leyó qué se había pulsado.

**El código de esta spec se escribió antes que sus promesas** (795–800 y la 72): se prueban por sabotaje, y eso
está dicho aquí porque es lo contrario de la regla.

## Cierre

- [x] Todas las promesas verdes
- [ ] Sabotaje comprobado, promesa por promesa
- [x] El banco: la continuación medida contra el servidor, y 6 metas logradas de 9 en tres corridas (las 3 que no, sin red)
- [ ] La investigación en Google, entera, tres corridas
- [ ] Estado de este documento: **implementado** (AAAA-MM-DD)
