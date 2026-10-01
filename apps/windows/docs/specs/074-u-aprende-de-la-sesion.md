# Plan de implementación: Ü aprende de cada sesión — habilidades y preferencias

Estado: **implementado** (2026-10-01) · Nace de la petición del dueño del 2026-09-30 · Rama: `jose/la-voz-conversa-y-aprende`
· Recoge la spec 046 de la rama `jose/ensenar-por-voz`, que nunca entró a `main`

> «Si yo ejecuto a mi asistente y lo guío, lo corrijo para que haga las cosas a mi manera, entonces él al
> final de esa ejecución debe analizar toda su ejecución durante la sesión y crear skills a partir de las
> correcciones que le hice y lo que le enseñé.» — el dueño, 2026-09-30.
>
> «Si un usuario muestra clara intención de enseñar algo, entonces pasa directo a skill; pero si solo hay
> repetición sin una intención explícita, pues obviamente también pasa a skill.» — el dueño, 2026-10-01.

## El encargo, como se midió su final

**Objetivo.** Que al cerrar una sesión de voz Ü repase lo que pasó y se quede con lo que la persona le
enseñó —cómo se hace algo (habilidad) y cómo quiere las cosas (preferencia)—, y que la sesión siguiente
abra sabiéndolo. Lo que se enseña a propósito queda guardado en el momento.

**La meta, en números:**

| | Antes (medido) | Meta | Al cerrar (medido el 2026-10-01) |
|---|---|---|---|
| Sesiones repasadas al cerrar | 0: no existe el repaso | todas las que tienen algo que repasar | 9 de 9 con el binario final; en otra corrida la app se cerró a mitad de un repaso y su diario siguió en disco |
| Batería de sesiones etiquetadas contra el modelo real (`sondas/DelRepaso`) | no existe | ≥ 90 % de decisiones correctas | 207 de 207 (100 %): 24 casos × 3 corridas |
| Enseñanza explícita que acaba en habilidad | 0 de 40 «LECCIÓN PERDIDA» de septiembre | 100 % de los casos de la batería | 21 de 21 repasos; y en la Ü de pruebas, guardada en el momento 2 de 2 |
| Aprendizajes del repaso sin una cita literal de la persona | 79 recuerdos que nadie enseñó, 7 de 16 «datos» que son ruido | 0: lo impide el código, no el prompt | 0; la compuerta no paró ninguna de las 68 propuestas: el modelo cita literal |
| Habilidades que el modelo que actúa puede usar | 0: la voz no tiene `map_skills` | todas: viajan en sus instrucciones | todas: 261–503 caracteres de lo aprendido en la apertura de cada sesión siguiente |
| Lo que tarda el repaso de una sesión | — | ≤ 10 s de mediana, en segundo plano | 3,2 s de mediana, 7,0 s el más lento (batería); 1,5–4,4 s en la Ü de pruebas |

## Diagnóstico: qué se midió

Auditoría del 2026-09-30 sobre `main`, los datos reales del dueño (respaldo del 30 de septiembre) y los
logs del 5 al 30 de septiembre:

| Qué | Medida | Fuente |
|---|---|---|
| Pipelines que leen la sesión y sacan aprendizajes | 0 | lectura de `Voice/`, `Teach/`, `Navigation/` y Graph |
| Skills del Learn por demostración en disco | 2, ninguna comprobada, ninguna ejecutada | `local-U/skills` del respaldo |
| Lo guardado que volvió al modelo que actúa | nada: el catálogo de la voz no tiene `map_skills` ni `map_skill_run` | `ConversacionEnVivo.Catalogo` |
| El momento que lo resume | 15:23:36 se guarda la skill de Gmail; 15:24:15 el dueño pide ese correo; Ü improvisa desde cero | `u-20260923-…-151936.log` |
| Una skill del Learn | 117 pasos para 6 acciones: uno por tecla | `Redactar-y-enviar-correo-….skill.json` |
| «Comprobar», requisito para usar una skill | 3 de 16 pasaron; 312 s de mediana; 46 USD en total | logs de `C:\U-dev2` |
| «Aprender de lo dicho» | dos listas de palabras que guardan la frase cruda: 7 de 16 entradas de la memoria personal son ruido | `GuardarDetallePersonalSiEsRelevante`, `memoria-personal.json` |
| Frases que sonaban a enseñanza y no dejaron nada | 40 «LECCIÓN PERDIDA» del 18 al 30 de septiembre | logs |
| Lo que queda registrado de una sesión | solo el texto de los turnos; ni herramientas, ni clics, ni a qué sesión pertenece | `ConversacionPersonal` |
| Dónde se pierde la memoria a mitad de sesión | 3 sitios volvían de un modo especial con las instrucciones de fábrica | arreglado en la spec 073 (`VolverAlModoNormalAsync`) |
| Cómo lo hace OpenAI | Codex, de código abierto: al quedar quieta una sesión, un modelo extrae y otro consolida en preferencias, un manual y `skills/` | `openai/codex`, `codex-rs/memories` |

**Por qué falló lo anterior, en una frase por causa:** lo guardado no volvía a quien actúa; la captura era
un volcado de eventos; usarlo exigía un paso de desarrollo; y «aprender de lo dicho» era una lista de
palabras.

## Por qué esto va dirigido por especificación

Porque la forma de fallo que ya se vio aquí es **«parece que aprendió»**. La voz contestó «Te tengo… la
guardo» sin guardar nada; «Aprendí «X»: 117 pasos» anunciaba algo que no se podía ejecutar; y la voz
escribió 79 recuerdos que nadie le enseñó. Un repaso hecho por un modelo es exactamente el sitio donde eso
vuelve a pasar. Por eso lo que se juzga no es lo que el modelo dice que aprendió: es **el archivo**, **las
instrucciones de la sesión siguiente** y **la cita** que justifica cada cosa.

**La regla del flujo, y no tiene excepciones:** ninguna línea de producción entra antes que la promesa que
la juzga. Cada fase empieza con el contrato ROTO y termina con el contrato INTACTO.

## El diseño, en siete frases

1. **Lo aprendido es texto**: una habilidad es un nombre, cuándo usarla y sus pasos; una preferencia es una
   frase. Un archivo, `aprendido.json`, junto a la memoria personal.
2. **Enseñar a propósito guarda en el momento**: el delegado tiene `habilidad_escribir` y la reconstruye
   entera a cada corrección. No se espera al cierre: a las 15:24:15 la skill tenía que estar ya.
3. **Mostrar es una pregunta**: `habilidad_lo_que_hice` le devuelve lo que la persona acaba de tocar, con
   el nombre con que `map_take` lo encuentra.
4. **Cada sesión deja un diario**: lo que dijo la persona, lo que hizo Ü y cómo salió, y lo que la persona
   tocó.
5. **Al cerrar, un modelo repasa el diario y PROPONE; el código APLICA.** Decide por lo que la persona
   dijo qué es habilidad y qué es preferencia, sin contar repeticiones; y cada propuesta trae la cita
   literal de la persona que la justifica. Si la cita no está en el diario, se descarta.
6. **La repetición se comprueba, no se declara**: lo que se hizo una vez sin intención de enseñar va a un
   cuaderno de observaciones que no viaja a la voz; una habilidad «por repetición» solo entra si ya estaba
   en ese cuaderno.
7. **La sesión siguiente abre sabiéndolo**, con presupuesto: lo aprendido cabe siempre, y el hilo de la
   conversación le cede sitio.
8. **Las preferencias le llegan también a quien habla.** Con GPT-Live quien actúa no habla: lo aprendido
   viaja en las instrucciones del delegado, y «háblame más corto» es para la voz. Al confirmarse la
   apertura la voz recibe las preferencias en un `session.instructions.append`.

### Qué es cada cosa, y cómo se decide

| Lo que dijo o hizo la persona | Qué se guarda | Cuándo |
|---|---|---|
| «Te voy a enseñar a…», «se hace así», «cuando te pida X, haz Y», «mira cómo se hace» | habilidad | a la primera, en el momento |
| «No, así no; primero…» sobre cómo se hace una tarea | habilidad: se reconstruye la que había, o se crea | a la primera |
| «Háblame más corto», «no me preguntes antes de guardar», «siempre en Chrome» | preferencia | a la primera |
| «Soy cardióloga», «trabajo con SAP» | dato, en la memoria personal | a la primera |
| Un procedimiento de varios pasos que salió bien, sin enseñarlo ni corregirlo | observación, en el cuaderno | no viaja a la voz |
| Ese mismo procedimiento, otra sesión | habilidad: sale del cuaderno | a la segunda |
| «Olvida eso», «ya no lo hagas así» | se quita | a la primera |
| Un saludo, una pregunta suelta, un dato solo de hoy | nada | — |

## La especificación

En el contrato del grafo, numeradas desde la 700 (la 046 reservó 400–407 en su rama; no se reutilizan):

| # | Promesa | Fase |
|---|---|---|
| 700 | lo aprendido se guarda al momento y sobrevive a cerrar y abrir: una habilidad con su nombre, cuándo y pasos, una preferencia y una observación del cuaderno | 1 |
| 701 | volver a enseñar una habilidad con el mismo nombre la reconstruye entera: queda una sola, sin pasos viejos, aunque el nombre llegue con otras mayúsculas o sin tildes | 1 |
| 702 | una habilidad sin nombre o sin pasos no se guarda, y la respuesta dice cuál de los dos falta; un archivo que no se puede leer se aparta en vez de pisarse | 1 |
| 703 | una sesión nueva abre sabiendo lo aprendido: las instrucciones de quien actúa llevan cada preferencia y cada habilidad con su cuándo y sus pasos, y el cuaderno de observaciones no viaja | 2 |
| 704 | lo aprendido cabe siempre: pasado su presupuesto las habilidades viajan como índice —nombre y cuándo— con la herramienta para leer sus pasos, y el hilo de la conversación cede sitio para que las instrucciones no pasen de lo que el servidor admite | 2 |
| 705 | quien actúa puede guardar una habilidad en el momento, leerla, olvidarla y preguntar lo que la persona acaba de hacer: las cuatro herramientas están en su catálogo, y sus instrucciones mandan reconstruirla entera a cada corrección y seguirla cuando se pide lo que describe | 2 |
| 706 | lo que la persona hizo se entrega entero, en orden y una sola vez: N clics con identidad dan N entradas y la consulta siguiente no las repite; un clic sobre la propia Ü o sin identidad no cuenta | 2 |
| 707 | el diario de la sesión guarda lo que dijo la persona, lo que hizo Ü con cómo salió y lo que la persona tocó, en orden; se escribe en disco al cerrar y se vuelve a leer igual | 3 |
| 708 | el repaso no guarda nada sin una cita literal de la persona que esté en el diario: una propuesta con una cita inventada, con palabras de Ü o sin cita se descarta, y queda dicho cuál y por qué | 4 |
| 709 | el repaso aplica lo que el modelo propone: una habilidad enseñada entra a la primera, una corrección reconstruye la que había, una preferencia entra con una vez, un dato va a la memoria personal y lo que se pide olvidar se quita | 4 |
| 710 | la repetición se comprueba, no se declara: una habilidad «por repetición» solo entra si ese procedimiento ya estaba en el cuaderno desde otra sesión; si no, se queda de observación, y el cuaderno no crece sin fin | 4 |
| 711 | un repaso que falla no pierde la sesión: su diario sigue pendiente y se repasa la próxima vez; uno que termina se retira, y repasar dos veces la misma sesión no duplica nada | 5 |
| 712 | una sesión sin nada que enseñar no llama al modelo: sin una frase de la persona con algo que decir no hay repaso, y se retira sin gastar | 5 |
| 713 | lo que se le pide al modelo lleva lo que Ü ya sabe y el diario, pide la respuesta con su forma exacta y dice las reglas: la intención de enseñar va directo a habilidad, la repetición sale del cuaderno, y sin cita no hay nada | 4 |
| 714 | cerrar una sesión que abrió deja su diario y lanza el repaso sin retrasar el cierre, y abrir una repasa lo que quedó pendiente | 5 |
| 715 | la Memoria enseña lo aprendido: las habilidades enseñadas hablando salen con las demás, y las preferencias tienen su apartado | 6 |
| 716 | las preferencias le llegan también a quien habla: al confirmarse la apertura la voz recibe las preferencias —no las habilidades, que son de quien actúa—, las más recientes primero y dentro de lo que cabe en un append; sin preferencias no se le manda nada | 7 |
| 717 | una preferencia se guarda en su sitio: quien actúa tiene preferencia_guardar, que escribe en lo aprendido y no en la memoria personal; sus instrucciones mandan usarla para cómo quiere las cosas la persona y dejan memory_remember para datos y compromisos; y el repaso propone como preferencia la que solo estaba entre los datos | 8 |

Y en el contrato de la voz:

| # | Promesa | Fase |
|---|---|---|
| 68 | lo que la persona prefiere le llega a quien habla: un session.instructions.append sin delegación con el texto dentro, que nunca pasa de lo que cabe en un append y lo dice si recorta; un protocolo de una sola voz no manda nada | 7 |

**La que cierra el asunto es la 703.** Mientras no exista, se puede guardar lo que se quiera y la sesión
siguiente no lo sabe: es exactamente lo que pasaba con las skills del Learn. **Y la que impide repetir el
otro fallo es la 708**: sin ella, el repaso es un modelo que se da por bueno a sí mismo.

### Promesa que cambia

La **622** («la Memoria cuenta TODO lo que Ü guarda de ti») pasa de doce apartados a trece: entra
«preferencias». Su enunciado no cambia; cambia la lista con que se juzga.

### Con qué se juzga cada una

- **700–702, 710**: el almacén sobre un archivo temporal de la prueba.
- **703–705**: las instrucciones y el catálogo compuestos a partir de un almacén con contenido; se juzga el
  texto que recibe el modelo, no el archivo.
- **706**: el rastro alimentado a mano con clics resueltos; sin gancho real y sin pantalla.
- **707, 711, 712**: el diario y la cola de pendientes sobre una carpeta temporal.
- **708–709, 713**: el repaso con un modelo de mentira que devuelve lo que la prueba le dicta. El modelo de
  verdad se mide aparte, con la batería de la sonda: el contrato no puede depender de la red.
- **714**: cableado, leído de la fuente.
- **715**: `LoQueUSabe.Leer` sobre carpetas temporales.
- **716 y la 68 de la voz**: el texto que sale del almacén y el mensaje que arma el protocolo; el cableado,
  leído de la fuente. Que la voz lo CUMPLA al hablar solo lo dice una persona oyéndola.

## Las fases

| Fase | Pone verde | Toca |
|---|---|---|
| 1 | 700–702 | nuevo `Voice/LoAprendido.cs` |
| 2 | 703–706 | `ConversacionEnVivo.cs` (catálogo, despacho, apertura); nuevo `Voice/LoQueHiciste.cs` |
| 3 | 707 | nuevo `Voice/DiarioDeLaSesion.cs`; `ConversacionEnVivo.cs` |
| 4 | 708–710, 713 | nuevo `Voice/ElRepaso.cs` |
| 5 | 711, 712, 714 | `ElRepaso.cs`, `ConversacionEnVivo.cs`, `FaceWindow.xaml.cs` |
| 6 | 715 | `Memoria/LoQueUSabe.cs` |
| 7 | 716, y la 68 de la voz | `voz/Realtime/IProtocolo.cs`, `ProtocoloGptLive.cs`, `LoAprendido.cs`, `ConversacionEnVivo.cs` |

| 8 | 717 | `ConversacionEnVivo.cs` (catálogo, despacho, instrucciones), `ElRepaso.cs` |

Las fases 7 y 8 no estaban en el plan. La 8 salió del nivel 4 (ver *Hallazgos*). La 7 salió al cablear la 703. Lo aprendido viaja en las instrucciones de quien
actúa, y con GPT-Live quien actúa no es quien habla. Una preferencia sobre cómo se habla que solo conoce
quien no habla es una preferencia que nadie cumple. Sus dos promesas se escribieron y se vieron rojas
(`⧗ PENDIENTE: «IProtocolo.ParaLaVoz» todavía no existe`) antes que su código.

## Lo que se retira, porque esto lo sustituye

- **`GuardarDetallePersonalSiEsRelevante`**: la lista de «me gusta», «soy», «tengo un» que guardaba la frase
  cruda. Es el origen de las 7 entradas de ruido. Lo que hacía lo hace el repaso, con cita y con criterio.
- **El aviso de «LECCIÓN PERDIDA» deja de empujar al modelo cuando ya guardó** con `habilidad_escribir`,
  `preferencia_guardar` o `memory_remember`: hoy solo lo callaba `map_esto_es`, y avisaba de un dato que sí
  se había guardado.
- **`memory_remember` deja de ser el sitio de las preferencias** (717). Sigue siendo el de los datos y los
  compromisos.

## Lo que NO entra

- **Borrar el Learn por demostración** (`Teach/`, el piloto, `map_skills`, el panel de aprendizajes). Es lo
  que falló, y hay que retirarlo; pero son decenas de archivos y de promesas (122–143, 168–201, 226–229), y
  hay ramas abiertas que lo tocan. Va en su rama `chore/`, con esto ya funcionando.
- **El prompt del repaso en Graph.** La regla dice que el cliente no lleva prompts, y este lo lleva, como ya
  los llevan la voz y la lectura cardiológica. En Graph no se podría probar desde la rama: Graph se despliega
  al mergear. Queda en un archivo aparte para moverlo entero.
- **Pasos anclados a selectores y un reproductor determinista.** Una habilidad se sigue con las manos que ya
  existen. Si hace falta, se construye encima: `habilidad_lo_que_hice` ya entrega los nombres.
- **Subir lo aprendido al backend.** Local, como la memoria personal.
- **Lo tecleado por la persona.** El rastro son clics; el valor escrito se lee de la pantalla o se pregunta.

## Hallazgos

1. **Una preferencia que solo conoce quien no habla** (fase 7). Lo aprendido viaja en las instrucciones del
   delegado; la voz de GPT-Live tiene su propia persona. «Háblame más corto» se habría guardado y nadie lo
   habría cumplido. Ahora la voz recibe las preferencias al confirmarse cada conexión, y otra vez en el
   momento en que se guarda una.
2. **La preferencia acababa guardada como un dato** (fase 8). En el primer nivel 4, a «de ahora en adelante
   dime solo el resultado, sin explicaciones» quien actúa llamó a `memory_remember` —sus instrucciones se
   lo mandaban—, y el repaso, que la vio ya guardada, no propuso nada: 0 preferencias, 13 de 14
   comprobaciones. Dos herramientas que se ofrecían para lo mismo. Con `preferencia_guardar` y la regla del
   repaso: 16 de 16.
3. **El repaso casi nunca tiene que escribir cuando se enseña a propósito**: quien actúa guarda en el momento
   (2 de 2 habilidades, 1 de 1 preferencia) y el repaso lo ve hecho y no lo duplica. Donde el repaso trabaja
   solo es en lo que nadie declaró: en la Ü de pruebas, «abre la calculadora y calcula 12 por 12» quedó
   apuntado en el cuaderno la primera sesión, pasó a habilidad «por repetición» la segunda, y la tercera
   abrió con ella en sus instrucciones.
4. **La primera versión del prompt dejaba pasar 1 de cada 2 procedimientos sin apuntar** (127 de 128 en la
   primera batería): «si la sesión no enseñó nada, devuelve la lista vacía» competía con «apunta la
   observación». Con la regla dicha —proponla siempre que hubo una tarea de dos o más pasos sin fallar—,
   192 de 192 y 207 de 207.
5. **Lo que se guarda en el momento no pasa por la compuerta de la cita.** `habilidad_escribir` y
   `preferencia_guardar` las llama quien actúa cuando la persona enseña; la cita se le exige al repaso, que
   es quien propone por su cuenta. Medido en la Ü de pruebas: en 11 sesiones que no enseñaban nada —pedir una
   cuenta, una pregunta suelta, escribir en el bloc de notas— quien actúa no guardó nada por su cuenta. Es
   una medida, no una garantía: si se viera guardar de más, el sitio es exigirle también a él la frase.

### Lo que se vio y NO es de esta spec

- **Una sesión escrita caduca a los ~30 s**: sin audio, el servidor manda «sesión cerrada: expired» y Ü
  reconecta sin continuidad, hasta cuatro veces. Una orden escrita que tarde más de eso se queda a medias.
  Con el micrófono abierto no pasa. Ya estaba en `main`.
- **`tecla: Ctrl+A` no selecciona todo en el Bloc de notas en español: abre «Abrir»** (seleccionar todo es
  Ctrl+E). Quien actúa lo usó cinco veces para reemplazar un texto y dejó cuatro diálogos abiertos.
- **Quien actúa no sabe qué día es**: escribió «2025-02-27» como fecha de hoy, y abrió `cmd` para preguntarla.

## Cierre

- [x] Todas las promesas verdes: VOZ ÍNTEGRA (54) y CONTRATO INTACTO (403)
- [x] Sabotaje comprobado, promesa por promesa: 35 roturas en seis tandas, y las 35 pusieron roja la suya (cada una comprobada aplicada antes de juzgar)
- [x] La batería de la sonda cumple la meta contra el modelo real: 207 de 207
- [x] Probado en la Ü real, con el log: enseñar, cerrar, abrir y pedir (16 de 16), y repetir sin enseñar
- [ ] **Sin probar: con el micrófono.** Todo el nivel 4 se hizo con órdenes escritas, que no abren el
      micrófono: no está medido que la voz HABLE distinto al recibir una preferencia, ni que
      `habilidad_lo_que_hice` recoja los clics de una persona de verdad. Eso lo tiene que oír y hacer alguien.
- [x] Estado de este documento: **implementado** (2026-10-01)

### Cómo se repite la medida

```powershell
dotnet build sondas\DelRepaso -c Release -o C:\U-tmp\sonda-del-repaso
C:\U-tmp\sonda-del-repaso\sonda-del-repaso.exe --veces 3            # la batería, contra gpt-6-luna
python scripts\nivel4-voz\por-ordenes\aprende.py <U.exe> <carpeta NUEVA> 8811 aprende   # la Ü real
```
