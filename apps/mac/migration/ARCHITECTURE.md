# Arquitectura de la migración

La referencia es la experiencia observable de Windows, no su estructura de clases. El catálogo contiene 41 grupos de capacidades: una fila parcial no equivale a paridad. Los documentos de especificación también contienen aspiraciones; su presencia no prueba que Windows ya las cumpla.

## Límites

- **UCore**: protocolos de Live/Luna/Jev, reglas de cancelación, resolución de objetivos, grafo y estado de presentación. Reglas deterministas con contratos sin escritorio ni red.
- **UMac**: AX, entrada, audio, permisos, Llavero, persistencia. Identificadores efímeros para actuar; identidad semántica separada para recordar. El acceso síncrono al Llavero se ejecuta fuera del hilo de interfaz.
- **UApp**: composición y vistas SwiftUI/AppKit. Carita y notch reciben estado y eventos; no deciden qué pulsar ni bloquean al ejecutor.

La ruta Jev sigue siendo una lectura AX acotada → elección entre controles observados → comprobación de generación/foco → acción. No construye contexto de Graph, enumera apps, captura imágenes ni espera animaciones en cada clic. Las escrituras de navegación se agrupan fuera de esa ruta. Una enseñanza explícita confirma éxito solo después de persistir.

## Memoria

`NavigationMemory` distingue conocimiento, ubicación y visibilidad. Una recarga nunca restaura controles como visibles. Identidades duplicadas no se aceptan para enseñar; los valores introducidos y los campos protegidos no se convierten en identidades persistentes. La siguiente salida de una ruta debe estar viva; cada paso posterior requiere una nueva observación. Los errores de formato o versión conservan el archivo original.

El almacenamiento local es JSON versionado y atómico; no se presenta como sincronización con Neo4j/Graph. Importación Windows, skills demostradas y reconciliación remota son capacidades pendientes independientes. No se ejecutarán selectores UIA sobre AX.

## Evidencia y latencia

`verify.py --test` registra huella de fuentes, contratos, compilación y matriz. `U --smoke-test /tmp/resultado.json`, desde el bundle instalado y con UFixture abierta, prueba AX, Unicode, memoria, cancelación y 20 lecturas locales. Su p50/p95 solo describe esa ventana, no un navegador ni la velocidad de Jev.

`U --execution-test /tmp/proveedores.json` verifica Graph, un intercambio Live 1/Luna y cinco decisiones Jev. No abre el micrófono; por tanto no demuestra voz de extremo a extremo. El audio real exige una prueba separada de captura, transcripción, respuesta audible e interrupción.

Medir por separado lectura AX, decisión de proveedor, acción, verificación y total. No fijar una promesa de latencia sin distribuciones reales en navegador y apps de escritorio. Una credencial pendiente, falta de saldo o permiso denegado queda como bloqueo, nunca como aprobado.

## Orden de siguientes ciclos

1. Completar evidencia instalada de memoria/notch y resolver cualquier fallo observado.
2. Voz real con interrupción y continuidad de turnos; credenciales sin congelar UI.
3. Observación por eventos y medición de latencia en superficies grandes.
4. Lecciones demostradas, parámetros obligatorios, biblioteca y replay verificado.
5. Memoria remota, fuentes de audio adicionales, herramientas faltantes y flujos especializados.
6. Distribución Developer ID/notarizada y actualización con identidad estable.

SAP/COM y escritorios virtuales de Windows requieren equivalentes explícitos; no se declaran compatibles por tener un wrapper vacío. Cada ciclo termina con evidencia o un bloqueo preciso.
