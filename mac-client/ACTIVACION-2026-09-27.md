# Activación por voz — evidencia del 27 de septiembre

Rama local: juanpablo/live-graph-recovery. No push ni cambios en main.

## Hallazgos

- El filtro anterior exigía saludo + nombre. Rechazaba “You”, “You te necesito” y órdenes directas.
- Reconocimiento real dentro de U.app, usando audio sintético y SFSpeechURLRecognitionRequest local:
  - Sin modelo personalizado, “Hola Yu, me escuchas” → “Hola yo me” (es-CO), “Hola me escuchas” (es-ES). No activación.
  - Con vocabulario/pronunciaciones locales personalizados: mismo WAV → “Hola You me escuchas”. Activación positiva.
  - Control negativo “Hola amor. Estoy hablando contigo. Vamos a salir esta tarde.” → transcripción correcta, no activación.
  - “Yu, te necesito” → “Yo te necesito”, todavía sin activación. NO se acepta “yo” como alias: sería una fuente de interrupciones.
- Los errores Apple 1101 aparecen también al cancelar/renovar tareas. No prueban por sí solos un fallo de permisos.
- Reproducir el saludo por altavoces no produjo activación observable por el micrófono. No se afirma una prueba completa del usuario → micrófono → Live → altavoz.

## Cambios

- Nombre directo con petición libre, saludos y preguntas dirigidas al nombre. Conserva rechazo de YouTube, ustedes y menciones incidentales.
- Vocabulario local pequeño con API oficial Apple, caché de ~7 MB, sin grabaciones ni servicio adicional. es-ES es solo el reconocedor local; la voz Live mantiene marin y pautas de español colombiano.
- Los fallos del reconocedor son visibles. Logs de dominio/código y coincidencia booleana; no contienen transcripciones de conversaciones ambientales.
- Silencio explícito: “no te estoy hablando”, “guarda silencio”, “estoy en una llamada”, “no me interrumpas” cierra Live al recibir su transcripción. Puede haber latencia de transcripción; no es identificación de hablante.
- Criterios compartidos de simplicidad, Kaizen y respeto del contexto social viajan a Live, Luna y Graph. No se presenta esto como una integración ejecutable de Hermes ni como aprendizaje persistente automático.
- Permisos, credenciales y diseño de cara no se cambian.

## Validación

28 contratos, 167 aserciones. Nuevas formas de activación fallaron antes del cambio.
Sabotaje deliberado desactivando coincidencias produjo fallo de contrato; restaurado y verde.
Build release e instalación canónica ~/Applications/U.app verificadas.

## Cómo probar

1. Abrir ~/Applications/U.app y esperar “Esperando que llames a You para conversar”.
2. Sin tocar la cara, decir “Hola You, ¿me escuchas?”.
3. Comprobar que cambia a conexión Live y responde. Este paso con voz humana sigue pendiente.
4. Decir “no te estoy hablando”: debe volver a espera local.
5. Hablar con otra persona sin invocar You: no debería responder.
6. Probar nombre solo y nombre + petición; registrar variantes que el reconocedor aún confunda. No declarar éxito global por un único saludo.

## Fuentes

- https://support.apple.com/en-us/105020 — Siri/nombre + solicitud.
- https://www.aboutamazon.com/news/devices/tips-to-unlock-useful-and-fun-alexa-features — palabras de activación.
- https://developer.apple.com/documentation/speech/sfcustomlanguagemodeldata — personalización local.
- https://developer.apple.com/documentation/speech/sfcustomlanguagemodeldata/custompronunciation — pronunciaciones y límites.
- https://hermes-agent.nousresearch.com/docs/user-guide/features/memory/ — contexto persistente y memoria.
