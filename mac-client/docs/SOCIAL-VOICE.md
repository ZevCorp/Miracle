# Atención conversacional de Live — 28 de septiembre de 2026

## Qué se incorporó

La investigación de toma de turnos describe cómo las personas evitan solaparse y
coordinan cuándo responder. La participación también depende del destinatario y
señales como la mirada; la app no dispone de todas esas señales. No se implementa
una supuesta neurona social ni se afirma identificación del hablante.

Referencias primarias:
- Stivers et al., PNAS 2009: https://pubmed.ncbi.nlm.nih.gov/19553212/
- Unaddressed participants’ gaze in multi-person interaction, 2015:
  https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2015.00098/full
- Políticas nativas de Live: https://developers.openai.com/api/docs/guides/live-prompting
- Contexto sin petición de hablar: https://developers.openai.com/api/docs/guides/live-conversations

Traducción de esos principios a decisiones de producto, no conclusión biológica:
- Escuchar audio no equivale a recibir una petición.
- No aconsejar ni reformular frases dirigidas a otra persona.
- En conversación compartida que incluya a Ü, aportar brevemente al terminar una idea.
- Dar paso al video; un llamado directo posterior sí merece respuesta.
- Una pausa no equivale a invitación. Ante destinatario incierto, silencio.
- Mantener micrófono continuo de Live y su gestión nativa de interrupciones.

Se corrigió LiveVoice.notify: enviaba session.commentary.append, que pide decir
información en voz alta. Ahora envía session.thinking.append. Se mantiene el
resultado para Luna y su continuación: no se pierde la finalización de tareas.
No se añadieron detectores de apps con audio, cámaras ni filtros locales de habla.
Kaizen, memoria, voz colombiana y preferencias del usuario se mantienen.

## Evidencia y límites

Contrato rojo antes del cambio; verde con 31 contratos y 192 aserciones. Cambiar
thinking por commentary deliberadamente hace fallar el contrato; restaurado y verde.

Primera evaluación sintética con el prompt real de Live:
- Llamado directo con contexto de video: respondió («Aquí estoy. Dime.»).
- Invitación a participar: respondió.
- Audio de video con contexto: 0 ms de audio audible.
- Conversación telefónica dirigida a María: FALLÓ, 9100 ms de consejos no solicitados.

Ese fallo motivó ejemplos explícitos de destinatario en el prompt, y una segunda
frase telefónica no incluida en ellos para comprobar generalización limitada.
El segundo ensayo silenció el caso de María, pero falló con Andrés (8300 ms de
consejos). Se retiraron los ejemplos específicos: la siguiente revisión utiliza
la política documentada de respuestas selectivas y continuidad del destinatario.
Una pregunta, un «oye» o una pausa dentro de la llamada no pasan el turno a Ü.
La sonda usa PCM sintético en tiempo real, diez segundos adicionales de silencio,
RMS > 0.001 para detectar habla y cuenta llamadas a herramientas. No abre micrófono,
no reproduce audio, no ejecuta herramientas y no escribe chats. Un error de red no
cuenta como silencio válido. No mide reconocimiento acústico ambiental ni garantiza
cero interrupciones. La activación local previa a Live es un mecanismo distinto.

## Repetir

Crear una carpeta temporal con cinco archivos AIFF sintéticos: direct.aiff,
other.aiff, other_unseen.aiff, shared.aiff y video.aiff. Frases utilizadas:

1. Hola Yu, ¿me escuchas? Necesito hablar contigo.
2. María, estoy hablando contigo por teléfono. ¿A qué hora nos vemos mañana?
3. Andrés, ¿sigues en la llamada? Oye, pásame la dirección por mensaje, que ya voy saliendo.
4. Yu, estamos conversando sobre cómo aprender. Participa con nosotros. ¿Qué ejemplo sencillo nos propones?
5. Bienvenidos a este video. Hoy vamos a hablar sobre el aprendizaje. Piensa en lo que te gustaría aprender mañana.

Generador utilizado: say, voz Eddy (Español (México)). Abrir el bundle compilado:
`open -n mac-client/.artifacts/U.app --args --social-voice-test /ruta/a/fixtures`
Produce results.json. Requiere la credencial existente de OpenAI; usa la API de pago.
La sonda conserva el prompt de producción, sin instrucciones para forzar respuestas
correctas ni herramientas simuladas. Solo los casos direct y video añaden contexto
factual de reproducción de video al iniciar.

## Resultado final e instalación

La tercera revisión pasó los cinco escenarios (una ejecución por escenario):

| Escenario | Audio audible | Llamadas de herramienta | Resultado |
| --- | ---: | ---: | --- |
| Llamado directo durante video | 1500 ms | 0 | Responde |
| Llamada a María | 0 ms | 0 | Silencio |
| Llamada a Andrés, frase no usada como ejemplo | 0 ms | 0 | Silencio |
| Invitación compartida | 11500 ms | 0 | Responde |
| Video | 0 ms | 0 | Silencio |

Son ensayos del prompt base, sin preferencias personales añadidas. No prueban
llamadas reales, atribución de voces superpuestas, calidad completa de la respuesta
ni activación desde sesión cerrada. Se observa cada audio y diez segundos después;
las respuestas largas pueden quedar cortadas por la ventana de prueba.

Instalada en ~/Applications/U.app con la firma local estable existente. Binario
instalado idéntico al artefacto probado. 157 mensajes conservados byte por byte
tras el cierre normal y la instalación. Interfaz comprobada: carita disponible,
estado Lista. Contexto personal (1870 caracteres) conservado. Copia previa en
~/Documents/Yu Backups/social-live-20260928-131325. Sin cambios ni push a main.

Para probar: abre esa copia, llama «Hola Yu, ¿me escuchas?», pide un video y después
vuelve a llamarlo. Comprueba por separado el silencio durante una conversación
ajena y la respuesta al incluirlo. Si no despierta desde Lista, el fallo está en
la activación local previa a Live y debe registrarse por separado.
