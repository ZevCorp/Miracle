# 002 — El notch, el muelle y Aprender, como en Windows

Estado: **en verde y probado en la app instalada** (2026-10-01) · Nace de los pedidos del dueño del
2026-09-30 y 2026-10-01 · Rama: `samuel/mac-funciona`

Lo que pidió el dueño: que el notch del Mac dejara de «quedarse trabado» y se comportara como el de
Windows (`PanelDeAcciones`); traer el panel lateral derecho (`Muelle`); traer Learn («Aprender»), en
español; que la voz no se quede muda; y, ya con todo en la mano, un notch del tamaño de la barra de
volumen de macOS, que no muestre lo que dicen las personas ni el contador de la escucha, con pausa a
su izquierda, y un muelle sin «Colgar» y con «Detener» en negro.

Se copió el comportamiento y su porqué, no el código: las reglas viven puras en `UCore`
(`NotchLayout`, `NotchSpeech`, `NotchPresence`, `DockRule`, `AuraRule`, `DemoStart`, `LessonBuilder`,
`ApprenticeMode`, `LearningClient`, `EchoGuard`) y `UApp` solo las convierte en ventanas.

## Diagnóstico: qué se midió

| Qué | Medida | Fuente |
|---|---|---|
| El notch «trabado» | lo que llegaba durante la salida se perdía con ella, y la caducidad lo quitaba de debajo del cursor | `NotchPresence` (las dos diferencias con Windows, escritas ahí) |
| La caída del notch aplastada | AppKit constreñía la ventana bajo la barra de menú: 13/21 en la primera corrida de la sonda | `NotchPanel.constrainFrameRect` |
| Ü «desaparecía» | al arrancar cerraba a la fuerza las otras copias; launchd lo leía como fallo y relanzaba la suya a los 10 s | `AppMain.terminateOlderCopies` |
| La voz, -25293 | el Llavero recuerda el cdhash del ayudante, y cada compilación daba uno nuevo | `build.sh` (ayudante cacheado) |
| La voz, -10875 | macOS rechaza la cancelación de eco en este Mac y el motor simple arrancado 5 ms después fallaba | `DuplexAudio.start` |
| Tamaño de la barra de volumen de macOS | 290 × 62 pt, esquinas de 20 | captura del dueño, 2026-10-01 |

## Promesas

| # | Promesa | Juez |
|---|---|---|
| 201 | El notch cuelga arriba y al centro, bajo la barra de menú, y nunca se sale del área libre | `testNotchHangsTopCentreUnderTheMenuBar` |
| 202 | Tocar el borde de arriba asoma el notch, y el puente hasta la pieza sostiene la intención | `testTopEdgeStripBringsTheNotchOutAndTheBridgeKeepsIt` |
| 203 | El notch guarda aparte la tarea y la actividad, y enseña una sola frase sin emojis | `testNotchSpeechKeepsTaskAndActivityApart` |
| 204 | El notch nace oculto, una novedad lo trae y caduca solo salvo con un paso en curso | `testNotchIsHiddenAtLaunchNewsBringsItOutAndItExpires` |
| 205 | Asomado solo por el cursor, alejarse lo retira; si tenía algo que decir, no | `testTouchingTheTopEdgeBringsItOutAndLeavingSendsItAway` |
| 206 | El notch nunca queda trabado entre irse y volver, ni se va de debajo del cursor | `testTheNotchNeverGetsStuckBetweenLeavingAndComing` |
| 207 | El chat abierto sostiene el notch: ni caduca ni se va con el cursor | `testTheChatHoldsTheNotch` |
| 208 | El notch llega cayendo con un rebote pequeño y se va subiendo | `testNotchDropsWithASmallBounceAndLeavesRising` |
| 209 | El muelle se despliega con el cursor y se queda mientras haya algo que leer o escribir | `testDockUnfoldsWithTheCursorAndStaysForWhatIsBeingRead` |
| 210 | La pestaña del muelle no se mueve del borde derecho mientras el panel crece a la izquierda | `testDockTabStaysOnTheRightEdgeWhileThePanelGrowsLeft` |
| 211 | Soltar la carita en el muelle la guarda, y al sacarla aparece bajo la mano y dentro de la pantalla | `testDockStoresTheDroppedFaceAndGivesItBackUnderTheHand` |
| 212 | El panel del muelle entra deslizándose desde la derecha y sale desvaneciéndose | `testDockSlidesInFromTheRightAndFadesOut` |
| 213 | Una frase más larga que el notch viaja de lado a lado y descansa en cada extremo | `testLongSentenceTravelsAndRestsAtEachEnd` |
| 214 | El aura está encendida solo mientras se enseña y deja libre el centro de la pantalla | `testAuraIsOnOnlyWhileTeachingAndLeavesTheCentreClear` |
| 215 | La demostración espera a que la app esté delante, sin cuenta atrás y sin decir «grabando» antes | `testDemoWaitsForTheAppInsteadOfCountingDown` |
| 216 | Cada clic es un paso, lo escrito en un campo es un solo paso y el de un campo protegido no lleva su valor | `testLessonKeepsEachClickAndOneStepPerTypedField` |
| 217 | La lección se guarda entera o no se guarda, y lo dicho queda en el paso en que se oyó | `testLessonIsWholeOrNotWrittenAndSpeechGoesToItsStep` |
| 218 | Mientras aprende, Ü mira pero no toca la pantalla | `testTheApprenticeLooksButNeverTouchesTheScreen` |
| 219 | Una credencial de voz rechazada (sin saldo, inválida) se distingue de un fallo de red | `testARefusedVoiceCredentialIsToldApartFromANetworkFailure` |
| 220 | Sin cancelación de eco y por altavoces, Ü no se oye a sí misma; con audífonos sí se la puede interrumpir | `testWithoutEchoCancellationUDoesNotHearItselfThroughTheSpeakers` |
| 221 | El JSON de un paso omite lo que no se vio | `testStepJSONLeavesOutWhatWasNotSeen` |
| 222 | La sesión de aprendizaje envía los pasos en orden a Graph y cierra, o deja el cierre pendiente | `testLearningSessionSendsStepsInOrderAndFinishesOrStaysPending` |

La promesa heredada 22 (`testNotchExpansionHasFixedSizesAndFitsSmallDisplays`) sigue siendo el juez del
tamaño: hoy mide 290 × 62 compacto y 420 × 360 con el chat.

## Lo que se probó, y en qué máquina

En el MacBook Air del dueño (macOS 27, una pantalla, 4 escritorios), sobre la app instalada con
`./instalar.sh`, con sondas que mueven el cursor de verdad y miden las ventanas desde el servidor de
ventanas. Una corrida en la que una persona toca el ratón se anula y se repite: no cuenta como fallo.

| Sonda | Qué hace | Resultado (2026-10-01) |
|---|---|---|
| `--notch-test` | 26 comprobaciones del notch y el muelle: asomo, caída, caducidad, chat, clics a través del margen, todos los escritorios, pausa con la voz abierta, guardar y sacar la carita | 26/26 en dos corridas limpias seguidas |
| `--learn-test` | pulsa Aprender en el muelle, hace una demostración real en UFixture, pulsa Terminar y lee la lección | 10/10 en dos corridas limpias |
| `--learn-test … real` | lo mismo contra el Graph real | 10/10: Graph estructuró y nombró el flujo |
| `--audio-test`, `--spoken-voice-test`, `--voice-keys-test` | motor de audio, frase hablada con respuesta audible, las dos claves por separado | pasan; la clave de OpenAI que entrega Graph responde 401 |
| `--execution-test` | Live 1 → herramienta, y Jev hace 5 clics verificados | pasa, 0,3–0,6 s por paso |

## Lo que queda fuera

- El video de la demostración y los cuadros antes y después de cada clic (Windows los manda a Gemini
  por su backend, no a Graph) y «Comprobar» la tarea aprendida.
- `M1_arrastreSigueAlCursor` de `--face-drag-test` falla por 7–8 px (umbral 3) también sin este
  cambio: es de la spec 003.
- La clave de OpenAI de `agent/claves` en Graph está rechazada (401): se corrige en el servidor.
