# Auditoría de la experiencia Windows → Mac

Referencia: código Windows del mismo checkout y las especificaciones enlazadas por `capabilities.json`. Revisión estática; no equivale a ejecutar Windows en esta máquina. Se distinguen los comportamientos del código de las propuestas en documentos antiguos.

## Superficies y recorridos que deben conservarse

| Recorrido | Referencia ejecutable Windows | Comportamiento exigible en Mac | Estado al iniciar esta revisión |
|---|---|---|---|
| Hablar y colgar | FaceWindow.xaml.cs: FaceGestures, StartMicByFace; ReglaDelToque | Un toque inicia Live; otro detiene captura y reproducción; sin esperar doble clic | Incorrecto: un toque abría ventana |
| Saber si escucha | ReglaDelHalo, PintarHalo | Halo detrás de la carita durante conexión real; responde al audio, desaparece al cerrar | Faltaba |
| Expresión y tema | FaceControl, ApplyTheme | Geometría y poses; claro/oscuro; error sin rojo por petición actual | Rojo pendiente de retirar |
| Mover la carita | FaceGestures, EdgeSnap, LanzarConScroll, ReglaDelViaje | Arrastrar sin activar voz; posición consistente; movimiento a cada clic sin retrasar acción | Seguimiento básico; faltan lanzamiento/docking |
| Chat accesible desde el notch | PanelDeAcciones + TalkPanel/Input/Bubble | Expandir para leer y escribir; mismo historial que voz; responder preguntas; cerrar sin perder texto | Notch solo tenía dos líneas |
| Estado compacto | LoQueDiceElNotch, MedidaDelNotch, PaletaDelNotch | Tarea literal persistente, paso separado, tamaño estable, monocromo, detenido distinto de fallo | Parcial |
| Mostrar y ocultar | PanelDeAcciones._asomo/_caducar; ReglaDelMuelle | Acceso por borde; no cerrar mientras se escribe; ventanas dentro del área visible | Falta gesto de borde y muelle |
| Interrupción de voz | ConversacionEnVivo, LiveAudio | Escuchar y hablar simultáneamente; no eco ni cola antigua; transcripciones independientes | Falta evidencia audible real |
| Entrada por fuentes | FuenteTelefono, fuente Omi; selección en barra | Fuente visible, desconexión y relevo coherentes | Solo dispositivo Mac |
| Trabajo delegado | ElTramo, ElDecisor, LoQueDiceElNotch | Live conversa mientras Luna planea y Jev ejecuta; resultado verificable | Implementación, falta prueba real completa |
| Escribir y confirmar | specs 021/024/026/041 | Mantener foco, Unicode, no duplicar, no deshacer Enter | Prueba local parcial |
| Aprender | TeachBtn/LearnBtn, Teach; AuraDeAprendizaje | Inicio/parada/reinicio, indicador inequívoco, capturas y voz con procedencia | Falta flujo completo |
| Biblioteca | WorkflowLibraryWindow, WorkflowsBtn, VideosBtn | Lista, navegación, pasos, renombrar/eliminar, ejecutar con parámetros, verificar | Falta; recuerdos no son skills |
| Memoria visible | TarjetasDeRecuerdo, Senalador, OnVerRecuerdos | Enseñar, ver, señalar, olvidar; no confundir recordado y vivo | Persistencia local; faltan tarjetas/contexto remoto |
| Herramientas auxiliares | OnToggleInspector/Locator, LogWindow | Inspección, diagnósticos y tiempos sin exponer claves | Parcial/incompleto |
| Cuenta y actualizaciones | LoginWindow, OnboardingWindow, Update | Identidad única, conexión real, rol, actualización estable y recuperable | Configuración y firma local; no distribución final |
| Trabajo especializado | ConsultaWindow, FaceWindow.Escritorio, Clinical | Consulta/notas/SAP, asistentes/escritorios, contexto correcto | Pendiente; requiere equivalentes Mac explícitos |

## Aclaración del notch

En este checkout Windows, `PanelDeAcciones` es compacto y no recibe clics; el chat está en `TalkPanel`, alojado junto a la barra/muelle. La petición actual del usuario fija el destino Mac: integrar ese chat en el notch expandido. Se conserva el estado compartido de conversación y el notch compacto, sin copiar el code-behind monolítico de Windows.

## Regla de cierre por recorrido

Contrato puro donde hay una regla; prueba instalada del gesto y su efecto; prueba con proveedores para voz/Luna/Jev; evidencia visual para interfaz. Una captura no prueba audio ni cancelación. Una compilación no prueba paridad. La lista de 41 capacidades continúa siendo el registro general; esta auditoría descompone interacciones que quedaban escondidas en filas demasiado amplias.
