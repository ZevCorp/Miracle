# 000 — Lo heredado

Los contratos que la Mac traía cuando entró al monorepo (#127), registrados como promesas el
2026-09-30. No es una spec escrita antes que su código: es el inventario de lo que ya se juzgaba,
para que desde aquí cada contrato tenga una fila y cada fila tenga un juez.

El juez de una fila es una función `test…` de `Tests/UCoreTests/`, y `ContractRunner.swift` la
llama. Los enunciados salen de leer cada función ese día. El contrato corre sin red, sin micrófono
y sin escritorio: `./contrato.sh`.

## Promesas

| # | Promesa | Juez |
|---|---|---|
| 1 | El archivo de la conversación conserva el historial y, si está dañado, falla sin borrarlo | `testConversationArchivePreservesHistoryAndRejectsCorruption` |
| 2 | Un avance de la tarea informa a la voz sin obligarla a hablar | `testTaskUpdatesInformWithoutDemandingSpeech` |
| 3 | La sesión Live usa `gpt-live-1` con sus políticas de conversación, sin detección de turnos propia | `testLiveUsesNativeConversationPolicy` |
| 4 | El saludo solo despierta a Ü cuando le hablan a ella, y pedir privacidad se reconoce | `testWakeGreetingRequiresDirectAddress` |
| 5 | Dos lecturas de la misma credencial comparten una sola consulta, y el acierto queda en caché hasta invalidarlo | `testCredentialReadsSharePendingWorkAndCacheSuccess` |
| 6 | El turno con Graph conserva la sesión, manda los resultados y la respuesta a una pregunta, y pide captura solo cuando Graph la pide | `testGraphWireContractAndQuestionContinuation` |
| 7 | Llegar al límite de turnos nunca se reporta como éxito | `testTurnLimitNeverReportsSuccess` |
| 8 | Cancelar impide cualquier acción, aunque la respuesta de red llegue después | `testCancellationPreventsActionsAfterNetworkReturns` |
| 9 | Una acción sin coordenadas válidas no se convierte en un clic en (0,0) | `testMalformedActionsDoNotClickOrigin` |
| 10 | Las coordenadas de la captura se convierten a la pantalla correcta, también en un monitor secundario, y las de fuera se rechazan | `testRetinaAndSecondaryDisplayCoordinates` |
| 11 | Tras parar o cambiar de aplicación, ninguna acción de la observación vieja pasa la compuerta | `testStopGateAndStaleObservation` |
| 12 | Graph solo se usa por HTTPS, y la credencial viaja en una cabecera, nunca en la URL | `testGraphRequiresHTTPSAndKeepsCredentialsOutOfURL` |
| 13 | Una etiqueta que tienen dos controles se rechaza hasta que se elige uno por su identidad | `testAmbiguousLabelsRequireDisambiguation` |
| 14 | Un lote de herramientas espera todos sus resultados y continúa una sola vez | `testToolBatchWaitsForEveryResultAndOnlyContinuesOnce` |
| 15 | Una acción que falla detiene las que dependían de ella y no puede acabar reportada como éxito | `testFailedActionStopsDependentBatchAndCannotBecomeSuccess` |
| 16 | Un 401 de Graph se reporta como fallo de autenticación, y el error del proveedor llega con su mensaje | `testHTTPAuthenticationErrorsAndCredentialFetch` |
| 17 | Si el procesamiento de voz no está disponible, el audio arranca con el del dispositivo | `testUnsupportedVoiceProcessingFallsBackToDeviceAudio` |
| 18 | Un micrófono de varios canales a 48 kHz produce PCM real a 24 kHz | `testMultichannelMicrophoneProducesReal24kPCM` |
| 19 | El protocolo Live 1 delega en Luna sin llamadas paralelas, entrega cada llamada una vez y no pasa de 32 KiB por resultado | `testLiveOneWireAndUTF8Limit` |
| 20 | Jev solo elige entre las opciones enviadas; una elección inventada, poco segura o peligrosa devuelve el control | `testJevClosedChoicesAndHandoff` |
| 21 | Jev reintenta un 429, no reintenta un 401, respeta su plazo y se puede cancelar | `testJevHTTPDeadlineRetryAndCancellation` |
| 22 | El notch tiene tamaños fijos y cabe en una pantalla pequeña | `testNotchExpansionHasFixedSizesAndFitsSmallDisplays` |
| 23 | El halo de la voz se apaga sin sesión y nunca se sale de su panel | `testConversationHaloIsBoundedAndOffWhenDisconnected` |
| 24 | Un error al conectar Live dice su código, y no lo confunde con permisos ni con saldo | `testLiveHandshakeErrorsDoNotMisreportPermissionsOrBalance` |
| 25 | La preferencia del usuario llega a Live, a Luna y a Graph tal como la escribió | `testAssistantContextReachesLiveAndGraphWithoutLosingTheUserPreference` |
| 26 | El audio Live conserva el tiempo en silencio y rechaza PCM roto | `testLiveAudioPreservesSilentTimeAndRejectsBrokenPCM` |
| 27 | La respuesta hablada se acumula en pantalla y se reinicia en el turno siguiente | `testVoicePresentationAccumulatesReplyAndResetsAtNextTurn` |
| 28 | La pantalla conserva la tarea, y distingue detenida de fallida | `testPresentationKeepsTaskAndDistinguishesStop` |
| 29 | Lo recordado nunca se da por vivo, y solo se enseña sobre un elemento que se vio | `testMemoryNeverTurnsRememberedIntoLive` |
| 30 | La memoria solo traza rutas por transiciones observadas | `testMemoryRoutesOnlyThroughObservedEdges` |
| 31 | La memoria se guarda y se recupera, y una memoria dañada falla sin borrarse | `testMemoryPersistenceAndCorruptionAreExplicit` |
