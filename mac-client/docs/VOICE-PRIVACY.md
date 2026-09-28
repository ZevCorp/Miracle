# Privacidad de voz — 2026-09-27

## Problema observado en código

LiveVoice enviaba PCM ambiente durante toda la sesión. Sus instrucciones pedían silencio,
pero no constituían un control local. AppModel comprobaba algunas frases después de
entregar el fragmento a la ruta de respuesta. El protocolo Windows de referencia documenta
que Live no ofrece los mismos controles de turno que Realtime; no se añadieron eventos
ni parámetros no verificados.

## Cambio local

- VoicePrivacyLatch conserva hasta 512 caracteres de transcripción incremental. Al detectar
  una petición de privacidad queda cerrado hasta una sesión nueva.
- LiveVoice cierra audio, websocket y tareas pendientes antes de entregar el fragmento a
  AppModel. onPrivacy conserva el fragmento en el chat, detiene la ejecución y vuelve a
  la escucha local de llamadas explícitas.
- Se reconocen también «estoy viendo un video», «estoy viendo una película»,
  «déjame ver el video» y «estoy hablando con otra persona».
- Las llamadas que incluyen una petición de silencio no reactivan Live.
- Live, Luna y Graph reciben instrucciones para no interpretar conversaciones ajenas como
  órdenes, aclarar una sola vez cuando el destinatario sea claro y verificar resultados.
  Estas instrucciones son orientación al modelo, no una garantía de cumplimiento.

## Evidencia

- Contrato escrito primero: rojo por ausencia de VoicePrivacyLatch.
- 30 contratos, 451 aserciones pasan. Las frases se prueban divididas en cada punto posible.
- Sabotaje: reemplazar la detección por false hace fallar ExperienceTests:11; restaurado.
- Compilación release firmada local-stable correcta.
- 18 comprobaciones de scroll pasan, 100 actualizaciones ~24 ms; voz simulada, no acústica.
- Instalada en ~/Applications/U.app; binario idéntico al compilado. CUA muestra
  «Ü, hablar con Live 1, Lista».
- Cierre normal antes de instalar; los 129 mensajes persistidos permanecieron idénticos
  byte por byte después de instalar. Copia privada de app, datos y preferencias:
  ~/Documents/Yu Backups/privacy-20260927-194000.

## Límites pendientes, no presentarlos como resueltos

No hay detector automático de reproducción de video, identificación del hablante ni una
compuerta semántica nativa por petición completa. El audio puede provocar respuesta antes
que llegue la transcripción de silencio. Un video que pronuncie una llamada explícita puede
activar la escucha local. El corte no deshace una acción que ya ocurrió. El criterio de cero
interrupciones ante audio arbitrario NO está verificado ni garantizado por este cambio.
No se realizó una prueba acústica de esta versión. La prueba de texto no la sustituye.

## Prueba manual de la copia instalada

1. Abrir ~/Applications/U.app y comenzar una conversación con la carita.
2. Decir «Yu, guarda silencio» o «estoy viendo un video».
3. Comprobar que termina la sesión y muestra «En silencio. Llámame cuando me necesites».
4. Ver un video sin llamadas a Yu: no debe haber una sesión Live transmitiendo.
5. Decir «Hola Yu, te necesito» para abrir una sesión nueva.
6. Revisar el historial anterior y desplazarse arriba mientras llega texto.

Hermes se conserva como referencia conceptual; no se modificó upstream. No se publicaron cambios.
