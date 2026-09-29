# Conversación nativa con Live 1 — 2026-09-28

## Decisión del usuario

Retirar el modo protegido propio y aprovechar Live 1 para la conversación continua.
Se mantienen la activación por voz, Luna, Jev, la memoria, preferencias y todos los chats.

## Documentación oficial consultada

- https://developers.openai.com/api/docs/models/gpt-live-1
- https://developers.openai.com/api/docs/guides/live
- https://developers.openai.com/api/docs/guides/live-prompting
- https://developers.openai.com/api/docs/guides/live-conversations
- https://developers.openai.com/api/docs/guides/live-delegation
- https://developers.openai.com/api/docs/guides/voice-websockets

Live gestiona escucha y habla simultáneas sobre audio continuo. No se añadieron
parámetros VAD de Realtime. El prompt usa Backchannel policy, Interruption policy y
Delegation policy, con reglas breves sobre pausas, conversación ajena y resultados.
La aplicación deja de cerrar sesiones al detectar otra app usando audio y deja de
sustituir la voz por transcripción durante videos. No corta sesiones por frases como
«estoy viendo un video»: Live interpreta la intención. La carita conserva su función
opcional de detener/iniciar; la activación por voz sigue habilitada por defecto.

Una sesión cerrada no escucha: la documentación requiere un activador de la aplicación.
Se conserva Speech local antes de abrir Live. Durante la conversación, el micrófono
va directamente a Live; no hay un filtro de nombre por turno. No se implementó todavía
el buffer acústico de apertura recomendado por la documentación; la frase de activación
se entrega como texto al conectar y el audio continúa en vivo.

## Fallo reproducido y corrección de activación

Grabación sintética «Hola u, me escuchas», voz Eddy español México:
macOS transcribió «Hola me escuchas». El filtro anterior la rechazaba.
Añadir U/Ü al modelo personalizado no cambió esa transcripción y se descartó ese ajuste.
Se admiten las preguntas completas solicitadas previamente por el usuario:
«Hola, ¿me escuchas?» y «Hola, ¿estás ahí?», además de los llamados existentes con
You/Yu/Ü. Un «hola» solo, YouTube y menciones indirectas siguen rechazándose.
La misma grabación pasó la prueba local. No es una prueba de identificación del hablante;
otra persona que diga exactamente esa frase puede activar Ü.

## Pruebas

- Contrato nuevo rojo antes del prompt; prueba de saludo rojo antes de ampliar frases.
- 30 contratos, 188 aserciones pasan. Se retiraron contratos de funciones eliminadas.
- Sabotaje del encabezado Backchannel policy hizo fallar el contrato; restaurado.
- Audio sintético de petición → Live 1 → llamada de prueba Luna → respuesta audible: pasa.
  Sin micrófono ambiente y sin acciones reales en esa sonda.
- El fallo previo de saldo no se reprodujo en la prueba actual.

No se promete cero interrupciones: las políticas son instrucciones al modelo y necesitan
ensayos conversacionales representativos, no solo comprobar campos de configuración.
Las evidencias del modo protegido en VOICE-ATTENTION.md son históricas; esa implementación
se retiró por petición del usuario. No se borraron conversaciones ni preferencias.

## Verificación instalada

Se instaló en ~/Applications/U.app con firma estable; 140 mensajes se conservaron
idénticos byte por byte al reiniciar. Scroll: 18 comprobaciones pasan.
WakeProbe ahora evalúa también latestPhrase, igual que Speech, y registra segmentos
de la grabación de prueba. La misma grabación sigue pasando esa ruta completa.
La prueba por altavoz/micrófono no activó: el reconocedor captó otro fragmento, no el
saludo reproducido. La comprobación con voz real del usuario está pendiente.
La sonda acústica opcional debe abrirse como bundle mediante open -n; lanzada como
ejecutable desde shell, macOS abortó la solicitud de autorización Speech por atribución
de la descripción de privacidad al proceso lanzador. La app normal no tuvo ese fallo.
