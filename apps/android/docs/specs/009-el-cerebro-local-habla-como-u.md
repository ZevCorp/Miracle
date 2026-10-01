# El cerebro local habla como la Ü de la constitución

Estado: **implementada** (2026-10-01; promesas 901-908 vistas ROJAS contra el código de antes —901-904 pendientes, 905-908
rotas por las frases viejas— y verdes después, contrato de 179 promesas; cada una se vio roja otra vez con un sabotaje del
código nuevo. Tras la revisión, 909-911 nuevas y 903, 904, 905 y 907 ampliadas, vistas rojas —905 por el «con speak» de
`GraphApp`, 907 porque al acabarse los turnos devolvía el texto de a mitad, 909-911 pendientes y luego rotas por las
fuentes de los cerebros y de `MemoryStore`— y verdes después: contrato de 182) · Rama: `claude/wizardly-brown-ld68hq`, la
misma que puso la constitución de Ü en Graph y en Windows.

Graph y la voz de Windows hablan desde el 2026-10-01 con **una sola constitución**
(`docs/monorepo/prompts-de-u.md`): quién es Ü, lo que le piden lo hace sin pedir permiso, y cómo trata a un médico o a
una persona. Android no la tenía: su proveedor por defecto es el cerebro **local** (`GraphApp.kt:102`, `OPENAI` →
`OpenAiBrain.kt`; con `GEMINI` → `GeminiBrain.kt`; solo con `GRAPH` usa el cerebro de Graph), y ese cerebro llevaba
escrita la Ü vieja. La misma persona oía a dos asistentes según el proveedor elegido en el panel de Desarrollador.

---

## Diagnóstico: medido en el código, no supuesto

| Qué decía | Dónde |
|---|---|
| «Eres Ü, un asistente con PERSONALIDAD viva y divertida» | `OpenAiBrain.kt:396` · `GeminiBrain.kt:383` |
| «En el campo "intent" … una frase corta y con chispa (ej: "Abro el cajón de apps 📲")»: emojis pedidos al modelo, y un campo que ninguna declaración de función tiene (`mcpFn` declara solo `t.params`) | `OpenAiBrain.kt:421` · `GeminiBrain.kt:405` |
| «Respuestas CORTAS … en el idioma del usuario»; «responde breve y humano ("¡Listo, lo tengo! 🙌")» | `OpenAiBrain.kt:428` · `GeminiBrain.kt:413-415` |
| «Para seleccionar texto, mantén presionado (long-press) sobre él»: el `computer` de OpenAI no tiene ninguna acción de toque largo | `OpenAiBrain.kt:406-408` |
| «usa SIEMPRE la herramienta» para SMS, correo y calendario, que en `AndroidSystemApi.kt` solo abren el borrador | `OpenAiBrain.kt:418-419` · `GeminiBrain.kt:398-399` |
| Ningún pilar de obedecer: nada de «no pidas permiso», ni de qué hacer si la persona no contesta | los dos `goalPrompt` |
| ask_user «cuando tengas una duda real e importante»; speak «con tu personalidad» | `OpenAiBrain.kt:205-206` · `GeminiBrain.kt:218-219` |
| La sangría del código fuente llegaba al modelo: `goalPrompt` es un `"""…""".trimIndent()` que interpola bloques de varias líneas sin sangría (el árbol de la pantalla, la memoria), así que la sangría mínima era 0 y no se quitaba nada | los dos `goalPrompt` |
| Sin respuesta a una pregunta: «usa tu mejor criterio», y sin canal «No hay usuario; usa tu mejor criterio.» — lo contrario de la constitución | `Engine.kt:120` |
| Narraba «¡Vamos! $goal» al empezar, «¡Listo! 🎉» siempre al terminar (también tras el resumen) y «✋ Paré, como pediste.» al parar | `Engine.kt:71,128,142` |
| Sin resumen ni acciones: «Mmm, no estoy seguro de haberte entendido. ¿Me lo dices de otra forma?» | `Engine.kt:138` |
| La burbuja narraba «¡Vamos! $prompt» antes que el motor | `FloatingBubble.kt:1031` |
| El aviso hablado del alto era «Vale, paro.», y «vale» es una de las palabras que la constitución nombra como ajenas | `Freno.kt:156` |
| Tras la primera llamada, la pantalla no volvía en `<pantalla>`: OpenAI solo mandaba los `function_call_output` (y la captura si hubo una computer_call), así que tras `set_alarm` o `launch_app` el modelo no veía la pantalla en todo el objetivo, aunque el prompt dice «cada turno te llega, dentro de <pantalla>…» y que termine cuando «la <pantalla> que te llegó» muestre el objetivo cumplido; Gemini mandaba el árbol suelto como campos `"screen"`/`"ui"` del JSON de cada resultado (Graph lo corrigió en `openaiBrain.js` y `geminiBrain.js`) | `OpenAiBrain.kt` · `GeminiBrain.kt` (rama de llamadas pendientes de `next`) |
| Cada llamada se contestaba con `actionResults.getOrElse(i)`, la posición de la LLAMADA, no la de su acción: speak, ask_user, take_screenshot y list_apps no producen acción y una computer_call (o un `type` con Enter) produce varias. Con `[speak, launch_app]` y launch_app fallido, launch_app recibía `getOrElse(1)` = «ok». Una función que no existe también recibía «ok» (Graph lo corrigió con `actionIndex` en 8b8dd61) | `OpenAiBrain.kt` · `GeminiBrain.kt` |
| El prompt dice «lo que está bajo General vale siempre», pero `MemoryStore.promptBlock` escribía las notas generales sueltas («- nota»), sin ninguna cabecera General, y las de app como «· app:» con «   - nota» | `MemoryStore.kt:60-71` |
| El prompt de Gemini decía «ni toque largo», pero su entorno `mobile` declara `long_press` y el cliente lo ejecuta (un deslizamiento quieto) | `PromptDelCerebroLocal.kt` · `GeminiBrain.kt:310-313` |
| La app reanuda el hilo en cada corrida, y el objetivo nuevo llegaba solo, sin «Objetivo del usuario:», mientras el prompt del hilo seguía diciendo «Objetivo del usuario: <el anterior>» | `OpenAiBrain.begin` · `GeminiBrain.begin` |
| Al acabarse los 40 turnos sin que el cerebro terminara, el motor narraba «Listo.» (o daba por final un texto de a mitad): daba por hecho lo que no comprobó | `Engine.kt` |
| Tras una pregunta por voz, el objetivo le pedía al cerebro «agradécele brevemente con speak y termina», y speak dice ahora «solo un aviso que no necesita respuesta… el resultado va en tu respuesta final» | `GraphApp.kt:538-541` |
| Textos fijos narrados o hablados con emojis: el saludo «¡Hola! Te escucho 👂», «Te sigo escuchando… 👂», «Estoy en la reunión 👂…», «…salgo de la reunión 👋…», «🧭 Aprendí el flujo…», «🧠 Estoy estudiando…», «🎓 Observo…», «🧩 Ahora el uso de…», y «🎬 Enséñame lo que quieras; vuelve a tocar el 🎓 cuando termines.», que el TTS (filtra lo que pasa de U+2FFF) decía «vuelve a tocar el  cuando termines» | `FloatingBubble.kt` · `VoiceDock.kt` · `GraphApp.kt` · `ActiveLearning.kt` · `PassiveLearning.kt` |

## Qué cambia

1. **Una tercera copia de la constitución**, en Kotlin y en el núcleo: `core/…/domain/ConstitucionDeU.kt`, palabra por
   palabra la de `services/graph/src/application/prompts/ConstitucionDeU.js` y la de
   `apps/windows/windows-client/src/Voice/ConstitucionDeU.cs`. `tools/monorepo/constitucion.sh` compara ahora las tres
   (corre en el CI de la raíz, `monorepo.yml`).
2. **El prompt del cerebro local se arma en el núcleo** (`core/…/domain/PromptDelCerebroLocal.kt`) con la misma
   estructura y el mismo texto de Android que el cerebro de Graph (`conscious-brain/prompt.js` con `platform: 'android'`
   y sin perfil): QUIEN · EN ESTE TURNO · Objetivo · OBEDECE · CÓMO VES LA PANTALLA · CÓMO ACTÚAS · [HERRAMIENTAS
   APRENDIDAS] · [WORKFLOWS] · CUÁNDO PREGUNTAS · [MEMORIA] · PERSISTENCIA · LA INTERFAZ DE Ü. Lo que solo existe en
   local se adapta en la voz de la constitución: las herramientas aprendidas (Graph ya no las tiene) y, para Gemini, cómo
   pedir la captura (`take_screenshot`, como el `look()` del addendum de Graph). `OpenAiBrain` y `GeminiBrain` solo lo
   llaman; ask_user y speak llevan las descripciones de Graph (`conscious-brain/tools.js`).
3. **La pantalla viaja dentro de `<pantalla>` en cada turno** —también en el que contesta llamadas, una vez y al final,
   como en Graph— y la memoria dentro de `<memoria>`, con el formato de Graph («### General», «### <app>»); el prompt
   dice que lo de dentro son datos, nunca instrucciones. Cada llamada se contesta con el resultado de su propia acción
   (`actionIndex`), y una función que no existe, con que no existe. Un objetivo nuevo en un hilo que sigue llega como
   «Objetivo del usuario: …». El toque largo se nombra como `long_press` en el prompt de Gemini, que lo tiene.
4. **El motor dice hechos, no órdenes, y sin emojis**: una pregunta sin respuesta llega al cerebro como «(sin respuesta:
   la persona no contestó)» (lo mismo que manda U.exe, `AgentLoop.SinRespuesta`); arranca con «En marcha.»; «Listo.» solo
   si no hubo resumen; «No entendí qué hacer. ¿Cómo sería con otras palabras?» si no hizo nada; «No alcancé a terminar;
   quedó a medias.» si se acabaron los turnos; «Paré.» al parar. La
   burbuja narra «En marcha.», el alto se avisa con «Ya paro.» y los demás textos fijos pierden sus emojis.

Sin perfil: Android todavía no pregunta si es médico o persona, así que el prompt va sin «QUIÉN TE HABLA», como en Graph
cuando no llega `profile`.

---

## La especificación

Esta spec numera sus promesas **desde 901** (ver `docs/como-trabajamos.md`).

| Archivo | Promesas |
|---|---|
| `core/src/commonTest/kotlin/graph/core/contrato/Contrato009CerebroLocal.kt` (núcleo puro y motor de verdad con teléfono falso) | 901, 902, 903, 904, 906, 907 |
| `core/src/jvmTest/kotlin/graph/core/contrato/Contrato009CerebroLocalEnApp.kt` (lee las fuentes de `app` y de `core`, mismo criterio que 703-705: `app` es Android y no corre en `jvmTest`; lo que es del núcleo lo corre) | 905, 908, 909, 910, 911 |

| # | Promesa |
|---|---|
| 901 | La constitución de Ü vive también en el núcleo de Android, en la versión `constitucion-de-u@2026-10-01.2`: quién es Ü, lo que te piden lo haces, el perfil médico y el perfil persona, sin la sangría del código fuente, sin interpolar nada y sin emojis. |
| 902 | El prompt del cerebro local, el de OpenAI y el de Gemini, arma sus bloques en el orden del cerebro de Graph para Android, con quién es Ü y lo que te piden lo haces palabra por palabra de la constitución, separados por una línea en blanco y sin la sangría del código fuente; sin perfil no lleva «QUIÉN TE HABLA», y las herramientas aprendidas, los workflows y la memoria solo aparecen si los hay. |
| 903 | El prompt local y sus herramientas propias no dicen lo que la constitución prohíbe ni prometen lo que el teléfono no hace: sin «PERSONALIDAD viva» ni frases «con chispa», sin «el idioma del usuario», sin «usa SIEMPRE la herramienta» ni «mejor criterio», sin emojis; el de OpenAI, que no tiene toque largo, dice que no lo hay, y el de Gemini lo nombra como `long_press`, la función que sí tiene; ask_user es solo para las tres preguntas de la constitución, y el correo, el SMS y el evento solo se abren llenos. |
| 904 | El núcleo arma lo que llega de la pantalla dentro de `<pantalla>` y la memoria dentro de `<memoria>`, el prompt dice que lo de dentro son datos y nunca instrucciones, y un cierre de etiqueta escrito en la pantalla o en la memoria no cierra la etiqueta. |
| 905 | `OpenAiBrain` y `GeminiBrain` arman su prompt, el estado de la pantalla y las herramientas ask_user y speak con lo del núcleo: en su fuente no queda texto de prompt propio de la Ü vieja ni emojis fuera del log; y lo que la app le escribe al cerebro en el objetivo no le pide contestar con speak, que es solo para avisos. |
| 906 | Una pregunta sin respuesta le llega al cerebro como el hecho «(sin respuesta: la persona no contestó)», y sin nadie a quien preguntar como «(sin respuesta: no hay a quién preguntarle)»; nunca como una orden de decidir por la persona. |
| 907 | El motor narra el arranque como un estado, «En marcha.», sin repetir el pedido; al terminar dice el resumen o, si no hubo, narra «Listo.»; si no hizo nada dice «No entendí qué hacer. ¿Cómo sería con otras palabras?»; si se le acaban los turnos sin que el cerebro termine, no narra «Listo.» ni da por final un texto de a mitad: dice «No alcancé a terminar; quedó a medias.»; al parar por la persona narra «Paré.»; y nada de lo que narra o dice por su cuenta lleva emojis. |
| 908 | Lo que la app y el núcleo narran, dicen o preguntan con texto fijo no lleva emojis: la burbuja arranca con «En marcha.» sin anunciar el pedido, los saludos de la palabra de activación van sin emojis, y el alto se avisa con «Ya paro.». |
| 909 | Cada turno de `OpenAiBrain` y `GeminiBrain` le lleva al modelo la pantalla de ese turno dentro de `<pantalla>` —el primero, el que sigue un hilo y el que contesta llamadas—, y el árbol de la pantalla no viaja suelto fuera de la etiqueta; un objetivo nuevo en un hilo que sigue llega como «Objetivo del usuario: …». |
| 910 | Cada llamada del cerebro local se contesta con el resultado de su propia acción, no con el de la que ocupa su lugar en la lista de llamadas; y una llamada a una herramienta que no existe se contesta diciendo que no existe, nunca «ok». |
| 911 | La memoria que la app le pasa al cerebro local la arma el núcleo con el formato de Graph: las notas generales bajo «### General» y las de cada app bajo «### <app>», una por renglón con «- » y sin sangría, que es lo que el prompt nombra cuando dice «lo que está bajo General». |

### Con qué se juzga

| # | Cómo se juzga sin tocar nada |
|---|---|
| 901 | `ConstitucionDeU` en `commonTest`: la versión; el comienzo y frases clave de cada texto («Sin emojis.», «nunca ordenador, móvil, vale, vosotros ni vos», «Si preguntaste y no te contestan…», «Llenar no es enviar», `{ESPECIALIDAD}` una vez); cada renglón con sangría empieza con «  · », y cada viñeta lleva esa sangría, como en Graph; ningún texto empieza o acaba en blanco, tiene `$` ni emojis. **Que diga palabra por palabra lo mismo que las otras dos copias lo juzga `tools/monorepo/constitucion.sh`**, que no es de este contrato porque lee archivos de otros proyectos: compara cada copia tal como la ve su programa (esta, después de `trimIndent()`), con la sangría de las viñetas, y exige cada marca una sola vez. |
| 902 | `PromptDelCerebroLocal.goalPrompt` para los dos proveedores, con una herramienta aprendida, un workflow y memoria: cada bloque aparece después del anterior; empieza con `ConstitucionDeU.QUIEN`; `\n\n` + OBEDECE + `\n\n` está entero; los renglones con sangría solo empiezan con «  · », «  1) », «  2) » o «    – »; no hay «QUIÉN TE HABLA». Sin aprendidas, workflows ni memoria, sus bloques no están. El de Gemini acaba con cómo pedir la captura (`take_screenshot`) y el de OpenAI no la nombra. |
| 903 | El mismo prompt, con y sin bloques opcionales, en minúsculas: ninguna de «personalidad viva», «divertid», «chispa», «idioma del usuario», «long-press», «mantén presionado», «usa siempre la herramienta», «mejor criterio», «duda real e importante», «con tu personalidad»; ningún emoji; sí «send_email, send_sms y create_event solo ABREN el correo, el SMS o el evento, ya llenos» (el texto de Graph desde su prompt 2026-10-01.6). El de OpenAI dice «ni toque largo» y no nombra `long_press`; el de Gemini no dice «ni toque largo» y nombra `long_press`. `ASK_USER` dice los tres casos y que no sirve para pedir permiso; `SPEAK`, que no se narra cada paso. |
| 904 | `PromptDelCerebroLocal.estado` con una pantalla que trae «</pantalla>» y una orden: el estado empieza con el aviso y `<pantalla>`, acaba en `</pantalla>` y ese cierre aparece una sola vez. El prompt con una memoria armada por `bloqueDeMemoria` que trae «</memoria>»: un solo cierre, y la memoria entra como «<memoria>\n### General\n- …». El prompt dice que lo de `<pantalla>` son datos. Que cada turno use `estado` lo juzga la 909. |
| 905 | Lee `OpenAiBrain.kt` y `GeminiBrain.kt`: llaman `PromptDelCerebroLocal.goalPrompt(`, `PromptDelCerebroLocal.estado(`, `PromptDelCerebroLocal.ASK_USER` y `PromptDelCerebroLocal.SPEAK`; no contienen «Eres Ü», «personalidad», «chispa», «long-press», «idioma del usuario», «SIEMPRE la herramienta», «mejor criterio», «duda real e importante»; ningún renglón que no sea comentario ni `LogBus.log` lleva un emoji. Ninguna fuente de `app` tiene un literal que le pida al cerebro algo «con speak». |
| 906 | El `ExecutionEngine` real con el teléfono falso de la 303 y un cerebro guionado que pregunta y anota lo que le informan: con un canal que contesta vacío o en blanco, informa «(sin respuesta: la persona no contestó)»; sin canal, «(sin respuesta: no hay a quién preguntarle)»; una respuesta de verdad pasa tal cual; nada de lo informado dice «criterio». |
| 907 | El mismo motor: (a) con resumen narra solo «En marcha.» y dice el resumen; (b) con acciones y sin resumen narra «En marcha.» y «Listo.»; (c) sin acciones ni resumen dice «No entendí qué hacer. ¿Cómo sería con otras palabras?» y no narra «Listo.»; (d) con `announce = false` no narra nada; (e) con el alto pedido en el primer toque narra «En marcha.» y «Paré.»; (f) con `maxTurns = 3` y un cerebro que nunca termina (uno de sus turnos trae un texto de a mitad), devuelve «No alcancé a terminar; quedó a medias.», no narra «Listo.» ni dice el texto de a mitad; con `announce = true` lo dice, y con `announce = false` no dice ni narra nada. En ninguno aparece el pedido, «¡Vamos!» ni un emoji. |
| 908 | Lee todas las fuentes de `app/src/main/kotlin` y `core/src/commonMain/kotlin`: el primer argumento literal de cada `narrate(`, `speak(` y `ask(` no lleva emojis ni empieza con «¡Vamos!» (y se encuentran al menos diez); los `SALUDOS` de `FloatingBubble` no llevan emojis; `runPromptAwait` narra «En marcha.» y ningún `narrate(` interpola `$prompt`; `Freno.ALTO` es «Ya paro.» y `Freno.DEVUELVO_EL_CONTROL` no lleva emojis. |
| 909 | `PromptDelCerebroLocal.continuacion("  abre la cámara \n")` es «Objetivo del usuario: abre la cámara». Lee `OpenAiBrain.kt` y `GeminiBrain.kt`: `next()` arma su turno con `primerTurno()`, `turnoQueSigue()` y `respuestas()`, y cada una llama `PromptDelCerebroLocal.estado(`; ninguno nombra `uiContext` (el árbol solo lo lee `estado`); los dos usan `PromptDelCerebroLocal.continuacion(`. Que la pantalla vaya una vez y al final, y la captura sin repetirse, se comprobó además corriendo los dos cerebros con stubs de `android.*` (ver «Lo que NO entra»). |
| 910 | `PromptDelCerebroLocal.herramientaQueNoExiste("borrar_todo")` dice «No existe» y nombra «borrar_todo», y no empieza con «ok». Lee los dos cerebros: su `class Call` declara `actionIndex: Int?`; `parseTurn` lo anota; `respuestas()` contesta con `actionResults.getOrNull(call.actionIndex)`, nunca por la posición de la llamada (`getOrElse(i)`, `[i]`, `getOrNull(i)`), y llama `PromptDelCerebroLocal.herramientaQueNoExiste(`. |
| 911 | `PromptDelCerebroLocal.bloqueDeMemoria`: sin notas, «»; con generales y de app, «### General\n- …\n- …\n\n### WhatsApp\n- …»; solo de app, sin General; las notas en blanco y las apps sin notas, fuera; una nota de dos renglones, en uno. El prompt con esa memoria dice «lo que está bajo General vale siempre» y la trae dentro de `<memoria>` con su formato. Lee `MemoryStore.kt`: `promptBlock` llama `PromptDelCerebroLocal.bloqueDeMemoria(` y no arma el formato con `appendLine`. |

## Lo que NO entra

- **El perfil médico o persona en Android.** El prompt local ya tiene dónde ponerlo (después de QUIEN, como Graph), pero
  Android todavía no lo pregunta. Mientras tanto las frases fijas nuevas no tutean ni ustedean («En marcha.», «Listo.»,
  «Paré.», «Ya paro.»); las que ya tuteaban y fija otra promesa («Listo, tienes el control de vuelta.», la 304) se quedan.
- **El rol del prompt.** Graph manda el prompt como `instructions` (OpenAI) o `system_instruction` (Gemini) en cada
  request; el cerebro local lo sigue mandando una vez, en el primer mensaje del hilo, junto a la pantalla, y la app
  reanuda el hilo en cada corrida. Lo que sí entró (909): el objetivo nuevo llega como «Objetivo del usuario: …», para
  que el modelo no siga con el del prompt del hilo. Lo que queda: los bloques del prompt que dependen de cuándo se abrió
  el hilo —HERRAMIENTAS APRENDIDAS, WORKFLOWS y MEMORIA— no se renuevan hasta que el hilo rota (las declaraciones de
  funciones sí van frescas en cada request). Cambiar el rol toca el protocolo de los dos cerebros locales y no se puede
  probar sin la app ni las claves.
- **La versión del prompt local en la telemetría** (Graph reporta `conscious-brain-android@…`): el cerebro local no
  reporta versión.
- **Comprobar a máquina que los textos de Android siguen a `prompt.js`.** La constitución la compara
  `constitucion.sh`; los bloques propios de Android (EN ESTE TURNO, CÓMO VES, CÓMO ACTÚAS, CUÁNDO PREGUNTAS,
  PERSISTENCIA, LA INTERFAZ DE Ü) se copiaron del texto ensamblado por Graph y hay que volver a copiarlos si Graph los
  cambia.
- **Quitar el toque largo de Gemini.** El entorno `mobile` de Gemini declara `long_press` y el cerebro local lo ejecuta
  (un deslizamiento quieto); decirle que no existía era contradecir una función que tiene delante, así que su prompt lo
  nombra (903) y sigue pidiendo copiar con `set_clipboard`. El de OpenAI, que no tiene toque largo, dice que no lo hay,
  como el de Graph.
- **«Listo.» al acabarse los turnos en U.exe.** `AgentLoop.cs` hace lo mismo que hacía `Engine.kt` (907 f): es de
  Windows y se arregla desde allí.
- **Las etiquetas de la interfaz** (`showBadge` de `VoiceDock`, los botones de `MainActivity`, los toasts): no son algo
  que Ü diga, y el «👂 te escucho…» del badge lo fija la 705.
- **La corrida a mano** en el teléfono (nivel 4 de la compuerta): `:app` no se compiló en la sesión que escribió esta spec
  (sin acceso al Maven de Google); lo compila `android-apk.yml`. Lo que sí se compiló: `:core` entero y, aparte,
  `OpenAiBrain.kt`, `GeminiBrain.kt` y `MemoryStore.kt` contra el núcleo nuevo con stubs de `android.*`, y sus turnos
  se corrieron sin red (parseTurn con una respuesta armada y `respuestas()` con los resultados del motor): cada llamada
  recibió el resultado de su acción, la que no existe «No existe la herramienta…», la pantalla fue una vez y dentro de
  `<pantalla>`, la captura no se repitió, y la memoria salió con «### General». El prompt ensamblado se comparó carácter
  por carácter con el que arma `prompt.js` para Android: igual, salvo las herramientas aprendidas, el toque largo de
  Gemini y su addendum, que son de aquí.
