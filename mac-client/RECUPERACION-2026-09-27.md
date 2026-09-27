# Recuperación de voz y contexto

Rama local: `juanpablo/live-graph-recovery`. Sin push ni cambios en main.

## Resultado posterior: recuperación y prueba hablada

La indicación de autorización pendiente más abajo describe el diagnóstico inicial, no el resultado final.

- Reproducción adicional: guardar en el proceso principal permitía reiniciar, pero volver a compilar la app perdía acceso a la credencial incluso con el mismo designated requirement. No bastaba con estabilizar la firma de AX.
- Se aisló el Llavero en UCredentialStore, un ejecutable sin dependencias del código de UI/voz. Solo atiende al padre Ü con el mismo certificado de firma; las claves viajan por pipes privados, nunca por argumentos o archivos. Un intento directo desde shell fue rechazado con código 77 sin leer el Llavero.
- Se recuperó la clave ya proporcionada por el usuario, validándola primero con Live/Luna y guardándola desde la app. No se concedió acceso universal al Llavero ni se borraron sus entradas históricas.
- Se cambió y recompiló el código principal, se reinstaló y se probó la voz SIN volver a aprovisionar la clave. Resultado: inputBytes=179292, spokenInputLunaToolAndAudibleReply=true, passed=true. La prueba transmitió una frase sintética, verificó la llamada health_check de Luna y exigió audio de respuesta con RMS > 0.001. No usó el micrófono ni controló aplicaciones.
- La captura real de micrófono se verificó por separado: 95728 bytes en dos segundos. La percepción del sonido por el usuario sigue requiriendo su prueba normal de conversación.
- Los diagnósticos ahora ejecutan un proceso separado sin terminar la interfaz abierta. Al concluir quedó un único proceso de interfaz instalado, PID 72662 durante la verificación.
- Para probar: tocar la cara pequeña y hablar. Ya no se requiere la secuencia de autorización descrita en el diagnóstico inicial.

Límite de distribución: el componente del Llavero debe conservar su binario durante actualizaciones locales de UI/voz. Si cambia el propio componente o el compilador, se debe validar/migrar su acceso antes de publicar. Una firma local no sustituye Developer ID para distribución pública. La conexión de Graph/Jev y una integración real de Hermes no se dan por verificadas con esta prueba de voz.

## Evidencia

- La segunda cara grande pertenece al proceso ChatGPT Computer Use, PID 54525 durante la inspección. No era otra instalación de Ü. Confirmado con CGWindowListCopyWindowInfo y NSRunningApplication.bundleURL.
- Copia instalada: ~/Applications/U.app, com.zevcorp.u.mac, firma local estable.
- El arranque anterior consultaba dos veces la credencial y descartaba una lectura que superase cinco segundos, incluso mientras macOS pedía autorización.
- La prueba de la app instalada, 2026-09-27T17:23:20Z, terminó con error de Llavero -25293 antes de abrir micrófono o conectar a Live. No está verificada una conversación de voz completa.
- La consulta silenciosa mediante LAContext no bastó para el ítem del llavero clásico. Se agregó la opción legacy de interacción, serializada y restaurada después de cada lectura. Esta API está deprecada, pero se usa por compatibilidad con los ítems existentes.
- 27 contratos, 142 aserciones pasaron. El contrato de contexto falló antes de conectar las preferencias a Luna.

## Cambios

- Lecturas de credenciales concurrentes comparten trabajo; las exitosas se conservan solo en memoria del proceso.
- Sin timeout que descarte una autorización válida; cancelación comprobada antes de usar el resultado.
- Las lecturas normales no presentan diálogos. Comprobar Live 1 permite autorización explícita dentro de la app.
- Se retiró el detector local de fin de frase agregado sin evidencia del protocolo; su prueba tampoco estaba registrada.
- El contexto personal persistente se envía a Live, Luna y Graph.

## Peticiones conservadas y límites actuales

- Kaizen, Hermes, lenguaje simple, ejemplos, calidez y no interrumpir conversaciones ajenas están guardados como preferencias personales. Se verificó su persistencia en UserDefaults sin modificarlos.
- Esto no demuestra una integración funcional de Hermes ni aprendizaje automático por Kaizen. No se ha implementado ni validado un ciclo de automejora en esta reparación.
- La memoria de navegación existente permanece en el proyecto; no se borraron recuerdos ni preferencias.
- El comportamiento social está guiado por instrucciones, no por un detector comprobado de llamadas o interlocutores. Requiere pruebas de conversación reales.
- Live 1, Luna y Jev conservan su arquitectura. La voz está pendiente de autorización del Llavero y de una prueba hablada completa.

## Prueba pendiente

Abrir ~/Applications/U.app. Menú contextual de la cara → Configuración. Pulsar Comprobar Live 1. Si macOS solicita acceso para Ü, introducir la contraseña local y escoger Permitir siempre. No autorizar herramientas Terminal/security para esta prueba. Esperar el resultado explícito de Live/Luna; después tocar la cara y decir una frase, comprobar respuesta audible y tocarla otra vez para cerrar. Reiniciar la app y repetir para comprobar persistencia de la autorización.
