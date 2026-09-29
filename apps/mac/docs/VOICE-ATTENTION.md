# Atención contextual de voz — 2026-09-27

> Registro histórico: la política de corte local y el modo protegido se retiraron por petición del usuario. Véase LIVE-NATIVE.md para el comportamiento vigente.

## Fuentes y decisión

- Apple Core Audio: kAudioHardwarePropertyProcessObjectList y
  kAudioProcessPropertyIsRunningInput / kAudioProcessPropertyIsRunningOutput.
  https://developer.apple.com/documentation/coreaudio/kaudioprocesspropertyisrunningoutput
- Referencia abierta consultada, sin añadir dependencia ni copiar implementación:
  https://github.com/sbooth/CAAudioHardware/blob/main/Sources/CAAudioHardware/AudioProcess.swift
- Detectar el destinatario es distinto de detectar una palabra de activación:
  https://arxiv.org/abs/2203.15975

Se implementó lectura nativa de metadatos de actividad, sin grabar audio de otras apps,
sin biometría y sin un nuevo servicio remoto. No se afirma reconocimiento humano del contexto.

## Comportamiento instalado

AudioEnvironment consulta procesos Core Audio (macOS 14.2+). Se excluye el PID propio.
Otra app con entrada o salida activa implica modo protegido; lectura fallida también,
pero el mensaje distingue ambas causas. Audio activo es una señal conservadora: no prueba
que haya un video o una llamada, ni permite detectar películas mudas o personas cercanas.

Al comenzar audio externo durante una sesión normal, el sondeo de 500 ms detiene la sesión
y la tarea en curso. El usuario puede invocar de nuevo a Ü. En modo protegido:

- El motor Live solo reproduce: no crea un tap de micrófono.
- El reconocimiento local admite únicamente frases con llamada explícita a Ü/You/Yu.
- Solo el texto de esa petición se envía al servicio; no el PCM ambiente.
- Audio/transcripción/herramientas de respuesta se descartan antes de la primera petición.
- Mientras Ü habla, se pausa la escucha local y se retoma un segundo después de vaciarse
  la reproducción. Para detenerlo durante su respuesta se usa la carita.
- No vuelve automáticamente al micrófono abierto cuando acaba la reproducción externa.
  Cerrar y reabrir la conversación permite evaluar el entorno otra vez.

Sin actividad externa se conserva la conversación Live existente. El modo protegido no
identifica hablantes y una llamada explícita desde un video aún puede disparar el ASR.
En un cuarto con conversaciones presenciales y sin audio de otra app no hay detección
fiable del destinatario. Los criterios sociales del modelo no sustituyen esa garantía.
El sondeo no garantiza corte instantáneo ni deshace una acción anterior al corte.

## Evidencia

- Promesa primero: contrato rojo por ausencia de los tipos de política.
- 31 contratos y 469 aserciones verdes.
- Sabotaje: permitir PCM en modo protegido hizo fallar el contrato; restaurado.
- 18 comprobaciones del scroll verdes; voz simulada en esa prueba.
- --attention-test: afplay reproduciendo un WAV de silencio fue detectado como proceso
  con salida. Playback-only de Ü no tenía entrada activa según Core Audio.
- Prueba de servicio bloqueada: Live devolvió credit_balance_exhausted antes de conectar.
  No se verificó respuesta hablada completa ni latencia ASR → Live en esta versión.
  No se reintentó ni se cambiaron credenciales/permisos para ocultar el error.

La sonda es optativa, no toca chats y escribe evidencia JSON. Su prueba de servicio puede
emitir una respuesta breve por los altavoces cuando la cuenta tiene saldo:

    ~/Applications/U.app/Contents/MacOS/U --attention-test /tmp/yu-attention.json

## Prueba manual tras restablecer saldo de la credencial Live

1. Abrir la copia ~/Applications/U.app y reproducir un video con audio.
2. Llamar «Yu, dime qué hora es». Debe aparecer modo protegido y responder solo a esa petición.
3. Dejar continuar el video sin dirigirse a Ü; no se envía su PCM a Live.
4. Probar una frase ajena («mira eso», «abre el navegador», dirigida a otra persona):
   el filtro local no debe enviarla en modo protegido.
5. Pausar el video, cerrar la conversación con la carita y volver a abrirla para Live normal.
6. Iniciar audio de otra app durante Live normal: debe cerrar la sesión automáticamente.
7. Verificar el historial previo y lectura arriba mientras se reciben mensajes.

Pendiente: ensayo acústico variado, activaciones falsas desde medios, conversaciones
presenciales y posibles falsos positivos por apps que mantienen streams abiertos en silencio.
No se promete cero interrupciones ni identificación de la persona dueña de la voz.

Cambios solo en mac-client, rama local; no cambios a Hermes, main ni publicación remota.

Instalación verificada: binario instalado idéntico al release; 138 mensajes idénticos byte por byte. Respaldo privado: /Users/juanpablo/Documents/Yu Backups/attention-20260927-224829.

## Corrección comprobada — 2026-09-28

Con saldo disponible, la sonda real detectó otro fallo: la sesión conectaba pero devolvía
cero bytes de audio sin entrada PCM. Se mantiene ahora el reloj de Live con bloques de
ceros generados localmente (100 ms). No contienen audio del micrófono ni de otras apps.
La métrica liveInputAudioBytesSent cuenta únicamente PCM capturado, excluyendo esos ceros.
Se reforzó la sonda: exige RMS > 0.001 y al menos 4800 bytes audibles; silencio recibido
no equivale a respuesta hablada. La versión corregida produjo 9600 bytes audibles y
cero bytes capturados enviados; lectura de Core Audio confirmó salida sin entrada.
El error credit_balance_exhausted anterior no se reprodujo. Activación acústica del
saludo de la persona todavía no verificada: los registros mostraban matched=false.
