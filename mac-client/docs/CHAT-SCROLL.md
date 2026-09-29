# Chat: lectura independiente de voz y streaming

## Inspección y alcance

ConversationView llamaba a scrollTo en cada cambio del último texto. No existía un modo de lectura. AppModel.append descartaba mensajes después de 150.

Cambio local reversible: ConversationView usa ChatTranscriptView (AppKit). Cada ventana/notch tiene su propio estado. El visor nativo mantiene una única selección y almacenamiento de texto; solo reemplaza el sufijo cambiado. Los mensajes ahora se identifican mediante Tú/You en un texto seleccionable continuo, en lugar de burbujas SwiftUI independientes.

- Abajo: sigue el contenido.
- Arriba: posición y selección se conservan; no modifica el primer respondedor.
- “Ir al mensaje actual · N”: cuenta mensajes nuevos o modificados, una vez por mensaje. Al pulsar o regresar abajo se reanuda.
- Page Up/Down y Home/End operan sobre el historial.
- No hay referencias del visor al micrófono, Live, herramientas o planificador.
- No se borra el historial al alcanzar 150 mensajes.

## Pruebas reproducibles

Desde mac-client, ejecutar ./test-chat-scroll.sh. Compila, lanza un proceso de diagnóstico separado y devuelve error si alguna comprobación falla. No cierra la aplicación en uso, no utiliza sus chats ni abre micrófono/red.

Evidencia: chat-scroll-evidence.json. Resultado final: 18 comprobaciones aprobadas, historial de 200 mensajes, 100 actualizaciones en ~23 ms en este Mac (medición de prueba, no garantía universal).
Incluye seguimiento abajo, lectura arriba, selección, foco, teclado, botón, retorno manual al final, contenido largo y conservación de todos los tokens.

Voz activa: simulación del estado speaking/micrófono activo para comprobar independencia. No se probó una conversación hablada real simultánea con este visor.

La prueba inicial no compilaba porque el componente todavía no existía. Control negativo posterior: reintroducir desplazamiento forzado hizo fallar “100 streaming updates preserve position”. Se restauró y pasó. También pasan los 28 contratos existentes, 170 aserciones. Build release y diff check correctos.

## Aplicación en ejecución

La versión nueva está compilada en .artifacts/U.app. No se reemplazó ni reinició la sesión instalada, para conservar su chat en memoria y su voz. El PID de la sesión instalada permaneció igual durante las pruebas.

Esto no añade persistencia del historial en disco: los chats preexistentes solo están en memoria. No cerrar una sesión cuyo contenido se necesite conservar sin copiarlo antes. Eliminar el límite de 150 evita descartes durante una sesión, pero implica crecimiento de memoria con historiales muy largos.

Para activar después de conservar la conversación actual: ejecutar ./instalar.sh. El instalador reinicia la app; la versión que estaba abierta no admite actualizar su código en caliente.

Prueba manual posterior: pedir una respuesta larga; subir y seleccionar texto mientras continúa; comprobar que el audio sigue y el texto seleccionado no se desplaza; pulsar “Ir al mensaje actual”; probar Page Up y End.

## Referencia conceptual

Se leyó exclusivamente README de la rama main de https://github.com/NousResearch/hermes-agent (vía raw.githubusercontent.com). Sirvió como referencia conceptual de memoria/ciclos de mejora, no como dependencia ni como código copiado. No se clonó, modificó ni publicó nada en Hermes.

Kaizen aplicado: observar fallo, cambiar el componente de desplazamiento, comprobar regresiones y documentar evidencia. Las reglas sociales y los prompts de voz quedaron fuera de este cambio de UX.

## Preservación antes de aplicar (27 septiembre, seguimiento)

El usuario pidió aplicar el cambio sin perder ninguna conversación. Se creó respaldo privado local fuera del repositorio: bundle Git verificado, app instalada, preferencias y directorio U Mac (memoria y firma). No se exportaron secretos del Llavero ni se alteraron credenciales.

Se añadió ConversationArchive: guarda mensajes con identificadores mediante escritura atómica, permisos 0600 y cola serial fuera del procesamiento de voz. Carga al iniciar, agrupa actualizaciones durante 300 ms y vacía escrituras pendientes al terminar normalmente. SIGTERM del instalador se dirige a terminación AppKit para ejecutar ese vaciado. Un cierre abrupto o fallo eléctrico todavía puede perder los últimos tokens antes de guardarlos; no se promete durabilidad absoluta.

Si falla la lectura, se conserva el archivo sin sobrescribir y se muestra un error. Los diagnósticos no cargan ni guardan el historial personal. Las preferencias y memoria preexistentes permanecen separadas.

Pruebas: 29 contratos/175 aserciones, incluyendo identidad/texto tras recarga, streaming guardado y corrupción explícita. Sabotear guardado para escribir [] hizo fallar el contrato; restaurado y verde. Las 18 comprobaciones del visor siguen pasando.

Estado de despliegue: NO se reinició ni reemplazó la sesión anterior. Su historial existe solo en RAM. La recuperación por accesibilidad es parcial: inicio, varias páginas intermedias y final guardados; faltan páginas del medio porque macOS se bloqueó. Es imprescindible desbloquear, completar recuperación y verificar cobertura antes de instalar. El archivo de respaldo parcial está marcado complete=false y NO se importa como si fuera una recuperación completa. Este chat de Codex no se modifica.

## Aplicación completada

Tras desbloquear el Mac se recuperó el texto expuesto por AX desde el inicio de la sesión hasta el último mensaje capturado, uniendo fragmentos con solapamiento exacto. Una sola secuencia, 13.985 caracteres, checksum de transferencia comprobado. SHA-256: 45cd7e47061e9167283886d789f6e8e3cac4be7f0b982a3cd47535202616cd2f.

Se guardó fuera del repositorio y se restauró en conversation.json como un bloque explícitamente identificado como “Historial anterior recuperado”. No se inventaron autores ni divisiones de turnos: AX mezclaba transcripciones de voz. No es una copia del audio ni de las burbujas originales, y no recupera contenido que ya hubiera desaparecido antes del respaldo.

Se verificó que el último mensaje no había cambiado antes de instalar. Se mantuvieron preferencias existentes y se añadió continuidad explícita sobre simplicidad, Kaizen, participación pertinente, silencio ante duda, Hermes conceptual, exploración pendiente de diarización y mejora pendiente de fluidez de audio. Ninguna petición pendiente se presentó como implementación verificada.

Instalación realizada en ~/Applications/U.app; binario comparado con el artefacto compilado. Las 18 comprobaciones del scroll se ejecutaron de nuevo usando el binario instalado y pasaron. El historial restaurado siguió presente después de esas pruebas. El chat de Codex y el upstream no se modificaron. Respaldo privado: ~/Documents/Yu Backups/20260927-151016.
