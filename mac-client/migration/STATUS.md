# Migración de experiencia Windows → Mac

Generado por `python3 mac-client/migration/verify.py --test`. Ninguna capacidad se considera migrada por existir su archivo.

Referencia Windows local: `c3d4399684688377d69eab449e8510dd11251603`. 48 documentos de especificación revisables; 34 nombres de herramientas referenciados.

| Capacidad | Implementación | App instalada | Criterio de aceptación |
|---|---|---|---|
| voice.session — Voz Live 1: conexión y cierre | partial | unverified | handshake real, audio de entrada/salida, cierre sin micrófono abierto |
| voice.duplex — Interrumpir mientras habla | partial | unverified | captura y reproducción simultáneas; sin eco; preservar tiempo PCM silencioso; cierre libera audio; interrupción audible real |
| voice.planner — Luna: delegación y continuación | partial | unverified | herramienta real exactamente una vez; resultado continúa; conversación disponible |
| voice.sources — Micrófono Mac, Omi y teléfono | missing | unverified | selección, desconexión y fallback observable por cada fuente |
| voice.errors — Credenciales, saldo y reconexión | partial | unverified | distinguir Llavero, Graph, HTTP, error de proveedor y audio local; no reintentar saldo/clave automáticamente |
| execution.jev — Jev: opciones cerradas, umbrales y plazo | partial | unverified | elección observada; no inventar controles; plazo total; fallo vuelve a Luna |
| execution.segment — Tramo independiente de la voz | partial | unverified | un único operador; pausa/cancelación; límite; entrega de resultado |
| execution.gate — Ventana y generación antes de actuar | partial | partial | ninguna acción tardía tras parar o cambiar ventana |
| execution.observer — Observación compartida y por eventos | missing | unverified | sin lecturas duplicadas; invalidación por cambios; p95 de detección |
| execution.typing — Escribir, comprobar y no duplicar | partial | partial | Unicode; foco; valor final verificado; no reintentar escritura irreversible |
| execution.controls — Clic, doble clic, menús, scroll, drag | partial | partial | acciones en fixture y navegador; geometría multipantalla |
| execution.batch — Batch sobre nodos vivos | partial | unverified | dependencias; parar primer fallo; reobservar al navegar |
| execution.latency — Reloj por fase y presupuesto del harness | partial | partial | p50/p95 AX, proveedor, acción, verificación y total; muestras reales |
| memory.graph — Grafo: vivo separado de recordado | partial | unverified | observar no borra; ubicación explícita; aristas solo comprobadas |
| memory.semantic — Recuerdos ligados a elementos | partial | partial | enseñar solo elementos vistos; persistir; recordar no permite pulsar |
| memory.persistence — Durabilidad y recuperación de memoria | partial | partial | guardar atómicamente; reiniciar; datos corruptos visibles; no borrado silencioso |
| memory.interop — Memoria Windows/backend y compatibilidad Mac | missing | unverified | importación/sincronización con procedencia; selectores Windows no ejecutables en Mac |
| memory.navigation — Próximo paso usando rutas aprendidas | partial | unverified | solo primer paso vivo; recalcular tras observar; ciclos acotados |
| learning.record — Aprender por demostración humana | missing | unverified | clics/teclas y narración con identidad temporal; sin secretos |
| learning.compile — Lección → skill con parámetros | missing | unverified | no reutilizar datos del ejemplo; conservar procedencia; validar huecos |
| learning.verify — Comprobar una skill en el terreno | missing | unverified | cada llegada por evidencia; no publicar como comprobada sin ejecución |
| learning.library — Catálogo de aprendizajes | missing | unverified | lista, descripción, mostrar, pasos, renombrar, eliminar, capturas propias |
| learning.replay — Reproducción con datos de esta corrida | missing | unverified | exigir parámetros; respetar control/foco; interrumpible; verificación |
| ui.face — Carita de Windows y estados | partial | partial | toque único abre/cierra Live; halo solo en sesión viva; audio mueve halo; claro/oscuro; expresión de error sin rojo; arrastrar no inicia voz |
| ui.follow — Carita junto al clic | partial | unverified | AX y coordenadas; multipantalla; no tapar destino; sin espera del ejecutor |
| ui.notch — Notch: tarea, paso, voz y parada | partial | partial | dos líneas compactas; expandir chat con historial/borrador compartido; escribir y responder preguntas; plegar conserva texto; tamaño acotado; borde/hover |
| ui.highlight — Señalar controles y recuerdos | partial | unverified | recuadro, selección múltiple, excluir y soltar; overlay no roba clics |
| ui.memorycard — Tarjetas del recuerdo durante ejecución | missing | unverified | tarjeta ligada al control vivo; texto legible; desaparece al actuar |
| ui.conversation — Conversación, entrada texto y voz | partial | partial | turnos completos, parciales separados, micrófono y cancelación coherentes |
| system.files — Navegar y buscar archivos | partial | unverified | listar, filtrar, buscar y abrir rutas sin inventarlas |
| system.apps — Apps, URL, ventanas y diálogos | partial | unverified | abrir/enfocar/verificar; atajos Mac; desbloquear modal |
| system.workspaces — Escritorios de trabajo y asistentes secundarios | missing | unverified | aislamiento real con equivalente Mac; nunca operar ventana ajena |
| system.permissions — Permisos e identidad instalada estable | partial | partial | actualizar misma app conserva permisos; detectar efectivo; consentimiento del SO |
| system.update — Distribución, firma y actualización | missing | unverified | firma Developer ID/notarización; actualizar y rollback sin perder identidad |
| account.identity — Cuenta, onboarding y rol | partial | unverified | misma identidad en toda la UI; credenciales Llavero; cerrar sesión |
| backend.contract — Graph y catálogo remoto | partial | unverified | auth vigente; catálogo real; schemas; errores HTTP explicados |
| clinical.consultation — Consulta y transcripción clínica | missing | unverified | flujo equivalente en Mac con datos de prueba; separación paciente/asistente |
| clinical.note — Nota, triage y ficha | missing | unverified | datos de la consulta correcta; no reutilizar ejemplos; revisión antes de escritura |
| clinical.sap — SAP y superficies específicas | missing | unverified | adaptador disponible en Mac o sesión Windows explícita; sin fingir COM en Mac |
| diagnostics.inspector — Inspector y trazas útiles | missing | unverified | lo visto frente a lo accionable; discrepancia visible; no guardar secretos |
| diagnostics.cost — Consumo, duración y costes | missing | unverified | duración de Live y proveedor reportados sin duplicar; fallo de reporte no bloquea |

Las pruebas instaladas parciales se enlazan en `capabilities.json`; no acreditan toda la fila. Sus hashes corresponden al binario probado, no necesariamente al código más reciente.

## Ciclo reproducible

1. Elegir una capacidad pendiente y escribir su contrato rojo.
2. Implementar en UCore (reglas), UMac (sistema) o UApp (presentación).
3. Ejecutar contratos y construcción; comprobar que una mutación de la regla rompe el contrato.
4. Probar el escenario instalado con datos de prueba; registrar resultado y tiempos.
5. Actualizar el catálogo solo con la evidencia obtenida y pasar a la siguiente capacidad.

Los fallos de saldo, permisos, credenciales o plataforma permanecen visibles y no cuentan como aprobados.
La evidencia reproducible, salida de pruebas y huella del código quedan en `.artifacts/migration/latest.json`.
