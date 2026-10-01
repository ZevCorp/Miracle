// El catálogo MCP del agente de escritorio: SOLO la declaración (nombre,
// descripción, esquema de parámetros, `via`). Port de Android/backend/src/domain/mcp.ts.
//
// Diferencia CLAVE con un catálogo clásico: aquí NO hay ejecutores. El cerebro
// vive en este backend y solo DECLARA las herramientas al modelo; la EJECUCIÓN
// ocurre en el cliente Windows, que tiene su propio registro `nombre -> ejecutor
// local` (gesto de Windows / acción de sistema). Así los prompts, descripciones
// y la lógica del catálogo — la innovación — nunca salen del servidor.
//
// Hay un catálogo por plataforma (ver domain/agent/platform.js): el de Windows,
// el de la app Android y el del Mac. Cada uno declara SOLO lo que ese cliente
// sabe ejecutar; declararle a un teléfono `switch_window` o el mapa UIA sería
// invitar al modelo a pedir algo que del otro lado no existe.
//
// UNA DESCRIPCIÓN DE HERRAMIENTA ES INSTRUCCIÓN, igual que el prompt: cambiar este
// archivo sube la versión del prompt de la plataforma afectada
// (conscious-brain/prompt.js). Un parámetro que el cliente tolera ausente lleva
// `optional: true` y no se declara como obligatorio.

const { PLATFORMS } = require('./platform');

const GESTURE = 'gesto de Windows';
const SYSTEM = 'API/acción del sistema (sin navegar la UI)';
const WORKFLOW_VIA = 'workflow (subconsciente ↔ consciente)';

/**
 * Gestos de navegación de Windows, análogos a los gestos de accesibilidad de
 * Android. El cliente los implementa con atajos del shell (Win, Win+D, Win+A,
 * Alt+Tab, rueda del ratón).
 */
const gestureTools = [
  { name: 'go_home', via: GESTURE, params: [], description: 'Muestra el escritorio (minimiza todo), equivalente a ir al inicio.' },
  { name: 'open_app_drawer', via: GESTURE, params: [], description: 'Abre el menú Inicio para buscar y lanzar aplicaciones.' },
  { name: 'open_notifications', via: GESTURE, params: [], description: 'Abre el centro de notificaciones de Windows.' },
  {
    name: 'switch_window', via: GESTURE,
    description: 'Cambia entre ventanas abiertas (Alt+Tab).',
    params: [{ name: 'direction', description: 'Hacia qué ventana moverse', options: ['next', 'previous'] }]
  },
  {
    name: 'scroll_menu', via: GESTURE,
    description: 'Desliza (scroll) dentro de una lista o menú.',
    params: [{ name: 'direction', description: 'Dirección del desplazamiento', options: ['up', 'down'] }]
  }
];

/**
 * Acciones del sistema por API/protocolo de Windows (headless, sin navegar la
 * UI). El cliente las implementa con `Process.Start`, protocolos (`mailto:`,
 * `ms-settings:`), el portapapeles, etc. El modelo las prefiere sobre
 * computer-use para tareas del sistema.
 */
const systemTools = [
  {
    name: 'launch_app', via: SYSTEM,
    description: 'Abre una aplicación por su nombre directamente (menú Inicio / ejecutable), sin navegar la UI.',
    params: [{ name: 'app', description: 'Nombre visible o ejecutable de la app' }]
  },
  {
    name: 'set_alarm', via: SYSTEM,
    description: 'Crea una alarma en la app Reloj de Windows / Tareas programadas.',
    params: [
      { name: 'hour', description: 'Hora 0-23' },
      { name: 'minute', description: 'Minuto 0-59' },
      { name: 'message', description: 'Etiqueta (opcional)', optional: true }
    ]
  },
  {
    name: 'set_timer', via: SYSTEM,
    description: 'Inicia un temporizador.',
    params: [
      { name: 'seconds', description: 'Duración en segundos' },
      { name: 'message', description: 'Etiqueta (opcional)', optional: true }
    ]
  },
  {
    name: 'create_event', via: SYSTEM,
    description: 'Crea un evento de calendario (protocolo del calendario / Outlook).',
    params: [
      { name: 'title', description: 'Título del evento' },
      { name: 'start', description: 'Inicio ISO-8601 local, p.ej. 2026-07-06T15:00 (opcional)', optional: true },
      { name: 'location', description: 'Lugar (opcional)', optional: true }
    ]
  },
  {
    name: 'dial', via: SYSTEM,
    description: 'Abre el marcador (tel:) con un número.',
    params: [{ name: 'number', description: 'Número de teléfono' }]
  },
  {
    name: 'send_sms', via: SYSTEM,
    description: 'Abre un SMS prellenado (protocolo sms:) — el usuario confirma el envío.',
    params: [
      { name: 'number', description: 'Destinatario' },
      { name: 'message', description: 'Texto (opcional)', optional: true }
    ]
  },
  {
    name: 'send_email', via: SYSTEM,
    description: 'Abre un correo prellenado (mailto:).',
    params: [
      { name: 'to', description: 'Destinatario (opcional)', optional: true },
      { name: 'subject', description: 'Asunto (opcional)', optional: true },
      { name: 'body', description: 'Cuerpo (opcional)', optional: true }
    ]
  },
  {
    name: 'web_search', via: SYSTEM,
    description: 'Busca en la web en el navegador por defecto.',
    params: [{ name: 'query', description: 'Qué buscar' }]
  },
  {
    name: 'open_url', via: SYSTEM,
    description: 'Abre una URL en el navegador.',
    params: [{ name: 'url', description: 'URL http(s)' }]
  },
  {
    name: 'open_maps', via: SYSTEM,
    description: 'Abre un lugar o búsqueda en el mapa.',
    params: [{ name: 'query', description: 'Lugar o búsqueda' }]
  },
  {
    name: 'directions', via: SYSTEM,
    description: 'Abre la navegación hacia un destino.',
    params: [{ name: 'destination', description: 'Destino' }]
  },
  {
    name: 'open_camera', via: SYSTEM,
    description: 'Abre la app de Cámara.',
    params: []
  },
  {
    name: 'open_settings', via: SYSTEM,
    description: 'Abre una pantalla de Configuración de Windows (ms-settings:).',
    params: [{ name: 'section', description: 'Sección', options: ['general', 'wifi', 'bluetooth', 'network', 'display', 'sound', 'battery', 'privacy', 'apps'] }]
  },
  {
    name: 'share_text', via: SYSTEM,
    description: 'Abre el diálogo de compartir de Windows con un texto.',
    params: [{ name: 'text', description: 'Texto a compartir' }]
  },
  {
    name: 'set_clipboard', via: SYSTEM,
    description: 'Copia un texto al portapapeles (sin UI).',
    params: [{ name: 'text', description: 'Texto a copiar' }]
  },
  {
    name: 'set_volume', via: SYSTEM,
    description: 'Ajusta el volumen del sistema directamente (sin UI) a un porcentaje 0-100.',
    params: [{ name: 'percent', description: 'Nivel 0-100 (usa 100 para asegurar que se oiga)' }]
  },
  {
    name: 'adjust_volume', via: SYSTEM,
    description: 'Sube, baja, muda o restaura el volumen del sistema con un solo golpe (como la tecla física).',
    params: [{ name: 'direction', description: 'Acción', options: ['raise', 'lower', 'mute', 'unmute'] }]
  }
];

/**
 * Gestos de accesibilidad de la app Android: los ejecuta su AccessibilityService.
 * Espejo de `Mcp.gestureTools` en Android/core/src/commonMain/kotlin/graph/core/domain/Model.kt
 * (nombres, descripciones y enums tal cual): el modelo solo puede pedir lo que el
 * teléfono sabe hacer.
 */
const ANDROID_GESTURE = 'gesto de accesibilidad';
const ANDROID_SYSTEM = 'Intent/API de Android';

const androidGestureTools = [
  { name: 'go_home', via: ANDROID_GESTURE, params: [], description: 'Vuelve a la pantalla de inicio (home) de Android.' },
  { name: 'open_app_drawer', via: ANDROID_GESTURE, params: [], description: 'Abre el cajón de aplicaciones deslizando hacia arriba desde el home.' },
  { name: 'open_notifications', via: ANDROID_GESTURE, params: [], description: 'Despliega la barra de notificaciones deslizando desde el borde superior.' },
  {
    name: 'pan_home', via: ANDROID_GESTURE,
    description: 'Cambia de panel dentro del home moviéndote hacia los lados.',
    params: [{ name: 'direction', description: 'Hacia dónde moverse en el home', options: ['left', 'right'] }]
  },
  {
    name: 'scroll_menu', via: ANDROID_GESTURE,
    description: 'Desliza (scroll) dentro de una lista o del cajón de aplicaciones.',
    params: [{ name: 'direction', description: 'Dirección del desplazamiento', options: ['up', 'down'] }]
  }
];

const ANDROID_STREAM = { name: 'stream', description: 'Canal de audio', options: ['media', 'ring', 'alarm', 'notification', 'call'] };

/**
 * Acciones del sistema por Intent/API de Android (headless, sin navegar la UI).
 * Espejo de `Mcp.systemTools` en el mismo Model.kt, en su orden.
 */
const androidSystemTools = [
  {
    name: 'launch_app', via: ANDROID_SYSTEM,
    description: 'Abre una aplicación por su nombre directamente (Intent de lanzamiento), sin navegar la UI.',
    params: [{ name: 'app', description: 'Nombre visible o paquete de la app' }]
  },
  {
    name: 'set_alarm', via: ANDROID_SYSTEM,
    description: 'Crea una alarma vía la API AlarmClock, sin abrir la interfaz del reloj.',
    params: [
      { name: 'hour', description: 'Hora 0-23' },
      { name: 'minute', description: 'Minuto 0-59' },
      { name: 'message', description: 'Etiqueta (opcional)', optional: true }
    ]
  },
  {
    name: 'set_timer', via: ANDROID_SYSTEM,
    description: 'Inicia un temporizador vía AlarmClock, sin UI.',
    params: [
      { name: 'seconds', description: 'Duración en segundos' },
      { name: 'message', description: 'Etiqueta (opcional)', optional: true }
    ]
  },
  { name: 'show_alarms', via: ANDROID_SYSTEM, params: [], description: 'Abre la lista de alarmas del reloj.' },
  {
    name: 'create_event', via: ANDROID_SYSTEM,
    description: 'Crea un evento de calendario vía Intent (prellenado).',
    params: [
      { name: 'title', description: 'Título del evento' },
      { name: 'start', description: 'Inicio ISO-8601 local, p.ej. 2026-07-06T15:00 (opcional)', optional: true },
      { name: 'location', description: 'Lugar (opcional)', optional: true }
    ]
  },
  {
    name: 'dial', via: ANDROID_SYSTEM,
    description: 'Abre el marcador con un número (sin llamar todavía).',
    params: [{ name: 'number', description: 'Número de teléfono' }]
  },
  {
    name: 'call', via: ANDROID_SYSTEM,
    description: 'Llama directamente a un número vía Intent (requiere permiso de llamada).',
    params: [{ name: 'number', description: 'Número de teléfono' }]
  },
  {
    name: 'send_sms', via: ANDROID_SYSTEM,
    description: 'Abre un SMS prellenado a un número (el usuario confirma el envío).',
    params: [
      { name: 'number', description: 'Destinatario' },
      { name: 'message', description: 'Texto (opcional)', optional: true }
    ]
  },
  {
    name: 'send_email', via: ANDROID_SYSTEM,
    description: 'Abre un correo prellenado.',
    params: [
      { name: 'to', description: 'Destinatario (opcional)', optional: true },
      { name: 'subject', description: 'Asunto (opcional)', optional: true },
      { name: 'body', description: 'Cuerpo (opcional)', optional: true }
    ]
  },
  {
    name: 'web_search', via: ANDROID_SYSTEM,
    description: 'Busca en la web vía el Intent de búsqueda del sistema.',
    params: [{ name: 'query', description: 'Qué buscar' }]
  },
  {
    name: 'open_url', via: ANDROID_SYSTEM,
    description: 'Abre una URL en el navegador.',
    params: [{ name: 'url', description: 'URL http(s)' }]
  },
  {
    name: 'check_simit_fines', via: ANDROID_SYSTEM, params: [],
    description: 'Abre el portal OFICIAL de SIMIT (Sistema Nacional de Información de Comparendos de Tránsito, simit.org.co) para consultar comparendos/multas de tránsito en Colombia por cédula o placa. Úsala cuando el usuario pida revisar sus comparendos o multas, o evaluar si uno prescribió/caducó. Tras abrir, sigue con computer-use: busca por cédula o placa (pregunta con ask_user cuál usar si no lo sabes) y lee, de cada infracción, su ESTADO (comparendo/pendiente de resolución VS. resolución o multa YA en firme) y su FECHA. CONOCIMIENTO LEGAL para razonar (Código Nacional de Tránsito, Ley 769 de 2002; SIEMPRE aclara al usuario que esto NO es asesoría legal definitiva y que debe confirmarlo con el organismo de tránsito): la CADUCIDAD (art. 161) es de 1 año desde el hecho — si sigue como "comparendo" SIN resolución sancionatoria en firme pasado ese año, la autoridad pudo haber perdido la facultad de sancionar; la PRESCRIPCIÓN (art. 159) es de 3 años, pero aplica al COBRO de una multa que YA está en firme (otro escenario distinto). Ninguna de las dos opera sola en el portal: hay que ALEGARLA mediante un derecho de petición ante el organismo de tránsito que impuso el comparendo (NO ante SIMIT, que solo consulta). LÍMITES ESTRICTOS: JAMÁS pagues, envíes ni radiques ningún formulario/recurso/derecho de petición en nombre del usuario — es una gestión legal ante un tercero y debe hacerla él mismo. Solo informa lo que encontraste y, si lo pide, redacta el TEXTO del derecho de petición (por chat o con send_email/share_text) para que él lo revise y presente.'
  },
  {
    name: 'open_maps', via: ANDROID_SYSTEM,
    description: 'Abre Maps en un lugar o búsqueda.',
    params: [{ name: 'query', description: 'Lugar o búsqueda' }]
  },
  {
    name: 'directions', via: ANDROID_SYSTEM,
    description: 'Abre la navegación hacia un destino.',
    params: [{ name: 'destination', description: 'Destino' }]
  },
  { name: 'open_camera', via: ANDROID_SYSTEM, params: [], description: 'Abre la cámara para tomar una foto.' },
  {
    name: 'open_settings', via: ANDROID_SYSTEM,
    description: 'Abre una pantalla de Ajustes del sistema.',
    params: [{ name: 'section', description: 'Sección', options: ['general', 'wifi', 'bluetooth', 'data', 'display', 'sound', 'battery', 'location', 'apps'] }]
  },
  {
    name: 'share_text', via: ANDROID_SYSTEM,
    description: 'Abre el diálogo de compartir con un texto.',
    params: [{ name: 'text', description: 'Texto a compartir' }]
  },
  {
    name: 'set_clipboard', via: ANDROID_SYSTEM,
    description: 'Copia un texto al portapapeles (sin UI).',
    params: [{ name: 'text', description: 'Texto a copiar' }]
  },
  {
    name: 'set_volume', via: ANDROID_SYSTEM,
    description: 'Ajusta el volumen de un canal de audio directamente (sin UI). Útil para asegurar que una alarma/llamada/medio se oiga.',
    params: [ANDROID_STREAM, { name: 'percent', description: 'Nivel 0-100 (usa 100 para asegurar que se oiga)' }]
  },
  {
    name: 'adjust_volume', via: ANDROID_SYSTEM,
    description: 'Sube, baja, muda o restaura el volumen de un canal de audio con un solo golpe (como el botón físico), sin necesitar un porcentaje exacto. Úsala, por ejemplo, para bajar el volumen tras poner música/un video si crees que puede molestar, o subirlo si el usuario no lo va a escuchar bien.',
    params: [ANDROID_STREAM, { name: 'direction', description: 'Acción', options: ['raise', 'lower', 'mute', 'unmute'] }]
  }
];

/**
 * Lo que el cliente Mac sabe ejecutar (apps/mac/Sources/UMac/Desktop.swift, `execute` y `tool`),
 * con los nombres y parámetros EXACTOS que lee. Opera la app al frente por sus controles de
 * accesibilidad (AX): pulsar por id o etiqueta no depende de coordenadas, así que va primero.
 *
 * No se declara lo que el Mac no tiene o hace a medias: alarmas, temporizadores, calendario,
 * notificaciones, volumen, `share_text` (copia al portapapeles, no comparte), `dial`, la cámara, el
 * mapa del computador de Windows (`map_places`, `map_routes_from`, `map_take`, `map_go_to`) ni las
 * lecturas (`map_where_am_i`, `read_screen`), que sobran: cada turno ya trae la pantalla. Tampoco
 * hay workflows: los grabados son de Windows y el Mac no tiene quien los reproduzca.
 */
const MAC_AX = 'control de accesibilidad (AX) de macOS';
const MAC_SYSTEM = 'acción de macOS (sin navegar la pantalla)';

const macTools = [
  {
    name: 'map_click', via: MAC_AX,
    description: 'Pulsa un control de la app al frente (AXPress). Es lo más fiable: no depende de coordenadas. Usa el id de la ÚLTIMA lectura de la pantalla o la etiqueta exacta del control.',
    params: [{ name: 'exit', description: 'Id del control en la última lectura, o su etiqueta exacta' }]
  },
  {
    name: 'map_type', via: MAC_AX,
    description: 'Escribe texto. Con exit deja ese texto completo en ese campo; sin exit teclea donde esté el foco.',
    params: [
      { name: 'exit', description: 'Id o etiqueta exacta del campo; vacío para teclear en el foco', optional: true },
      { name: 'text', description: 'El texto completo' }
    ]
  },
  {
    name: 'map_key', via: MAC_AX,
    description: 'Pulsa una tecla o un atajo de Mac, con Command y no Control: enter, tab, esc, space, backspace, delete, left, right, up, down, cmd+l, cmd+a, cmd+c, cmd+v, cmd+s, cmd+w.',
    params: [{ name: 'key', description: 'La tecla o el atajo, p. ej. "enter" o "cmd+l"' }]
  },
  {
    name: 'map_scroll', via: MAC_AX,
    description: 'Desplaza la app al frente: arriba, abajo, al principio o al final.',
    params: [{ name: 'direction', description: 'Hacia dónde', options: ['up', 'down', 'home', 'end'] }]
  },
  {
    name: 'map_look', via: MAC_AX, params: [],
    description: 'Pide una captura de la pantalla en la próxima lectura, para ver imágenes, colores o lo que los controles no muestran.'
  },
  {
    name: 'map_show', via: MAC_AX,
    description: 'Señala un control en la pantalla sin pulsarlo. Sirve cuando la persona pregunta dónde está algo.',
    params: [{ name: 'exit', description: 'Id o etiqueta exacta del control' }]
  },
  {
    name: 'launch_app', via: MAC_SYSTEM,
    description: 'Abre o trae al frente una aplicación por su nombre visible o su bundle id.',
    params: [{ name: 'app', description: 'Nombre visible (p. ej. "Notas") o bundle id (p. ej. "com.apple.Notes")' }]
  },
  {
    name: 'open_url', via: MAC_SYSTEM,
    description: 'Abre una URL en el navegador.',
    params: [{ name: 'url', description: 'URL http(s)' }]
  },
  {
    name: 'web_search', via: MAC_SYSTEM,
    description: 'Busca en la web en el navegador.',
    params: [{ name: 'query', description: 'Qué buscar' }]
  },
  {
    name: 'open_maps', via: MAC_SYSTEM,
    description: 'Abre un lugar o una búsqueda en Mapas.',
    params: [{ name: 'query', description: 'Lugar o búsqueda' }]
  },
  {
    name: 'directions', via: MAC_SYSTEM,
    description: 'Abre en Mapas la ruta hacia un destino.',
    params: [{ name: 'destination', description: 'Destino' }]
  },
  {
    name: 'send_email', via: MAC_SYSTEM,
    description: 'Abre un borrador en Mail con lo que le pases. No lo envía: el envío se hace en la ventana de Mail.',
    params: [
      { name: 'to', description: 'Destinatario', optional: true },
      { name: 'subject', description: 'Asunto', optional: true },
      { name: 'body', description: 'Cuerpo', optional: true }
    ]
  },
  {
    name: 'send_sms', via: MAC_SYSTEM,
    description: 'Abre un borrador en Mensajes con el número y el texto. No lo envía.',
    params: [
      { name: 'number', description: 'Número del destinatario' },
      { name: 'message', description: 'Texto', optional: true }
    ]
  },
  {
    name: 'set_clipboard', via: MAC_SYSTEM,
    description: 'Copia un texto al portapapeles.',
    params: [{ name: 'text', description: 'Texto a copiar' }]
  },
  {
    name: 'file_go', via: MAC_SYSTEM,
    description: 'Muestra un archivo o una carpeta en el Finder.',
    params: [{ name: 'path', description: 'Ruta; "~" es la carpeta de la persona' }]
  },
  {
    name: 'switch_window', via: MAC_SYSTEM,
    description: 'Cambia a la app siguiente o a la anterior (Command+Tab).',
    params: [{ name: 'direction', description: 'Hacia qué app moverse', options: ['next', 'previous'] }]
  },
  { name: 'go_home', via: MAC_SYSTEM, params: [], description: 'Muestra el escritorio.' },
  { name: 'open_settings', via: MAC_SYSTEM, params: [], description: 'Abre Configuración del Sistema.' },
  { name: 'open_app_drawer', via: MAC_SYSTEM, params: [], description: 'Abre la carpeta Aplicaciones en el Finder.' }
];

/**
 * El catálogo MCP base de cada plataforma. Los WORKFLOWS se añaden encima en
 * runtime desde el store de aprendizaje (ver learning.js), sin tocar esto, en
 * Windows y en Android; el Mac no los lleva.
 *
 * Sin plataforma, o con una que no sea Android ni Mac, es el de Windows de
 * siempre. Android no lleva el mapa del computador (map_*: es un grafo de
 * superficies UIA) ni switch_window (Alt+Tab no existe en un teléfono).
 */
function baseCatalog(platform = PLATFORMS.WINDOWS) {
  if (platform === PLATFORMS.ANDROID) return [...androidGestureTools, ...androidSystemTools];
  if (platform === PLATFORMS.MAC) return [...macTools];
  return [...gestureTools, ...systemTools, ...mapTools];
}

/**
 * EL MAPA DEL COMPUTADOR. El cliente construye pasivamente un grafo de las pantallas que ha visto
 * —nodos= superficies, aristas= transiciones con la acción que las provoca— mientras el usuario
 * trabaja, sin que nadie enseñe nada. Esto lo expone al modelo.
 *
 * Es distinto de un workflow y conviene que el modelo lo entienda: un workflow es una tarea que
 * alguien enseñó a propósito; el mapa es terreno conocido. Sirve para LLEGAR a sitios, no para
 * hacer tareas.
 *
 * Las descripciones dicen lo que el mapa NO sabe además de lo que sabe. El terreno se aprende
 * observando y su precisión medida ronda el 78%: un modelo que crea que es infalible improvisará
 * sobre pantallas equivocadas, y uno que sepa que puede fallar preguntará o verificará. El cliente
 * comprueba la llegada en cada tramo y se detiene si no coincide — por eso `map_go_to` puede
 * responder "me quedé a mitad", y eso es una respuesta correcta, no un error.
 */
const MAP_VIA = 'mapa del computador (terreno aprendido por observación)';

const mapTools = [
  {
    name: 'map_where_am_i', via: MAP_VIA, params: [],
    description: 'Dice en qué pantalla está el usuario ahora mismo y cuántas salidas conocidas tiene.'
  },
  {
    name: 'map_places', via: MAP_VIA,
    description: 'Lista las pantallas que el mapa conoce, las más visitadas primero. Útil para saber a dónde se PUEDE ir antes de intentarlo.',
    params: [{ name: 'app', description: 'Filtrar por app o dominio (opcional), p.ej. "explorer.exe" o "github.com"', optional: true }]
  },
  {
    name: 'map_routes_from', via: MAP_VIA,
    description: 'Salidas conocidas de una pantalla y con qué elemento se recorre cada una. Indica explícitamente las que se observaron pero cuya acción se desconoce.',
    params: [{ name: 'surface', description: 'Id de superficie; si se omite, la pantalla actual', optional: true }]
  },
  {
    name: 'map_take', via: MAP_VIA,
    description: 'Toma UNA salida de la pantalla actual, elegida por su nombre tal como lo devuelve map_routes_from (p.ej. "Videos", "Documentos"). Es la forma natural de navegar el mapa: pide las salidas, elige la que sirva, y toma esa. Si el nombre coincide con varias, las devuelve para que elijas en vez de adivinar. Verifica la llegada.',
    params: [{ name: 'exit', description: 'Nombre de la salida, como aparece en map_routes_from' }]
  },
  {
    name: 'map_go_to', via: MAP_VIA,
    description: 'Navega hasta una pantalla conocida recorriendo la ruta aprendida, verificando la llegada en cada paso. Solo usa rutas COMPLETAS: si falta saber cómo se recorre algún tramo, no se mueve y lo dice. Si un paso no llega a donde debía, se detiene e informa dónde quedó.',
    params: [{ name: 'surface', description: 'Id de superficie destino, tal como aparece en map_places' }]
  }
];

/** Nombres de las herramientas (para distinguir llamadas MCP de las funciones propias). */
function catalogNames(tools) {
  return new Set(tools.map((tool) => tool.name));
}

/** Los nombres del catálogo del Mac, en su orden (los fija verify-agent-platform.js). */
const MAC_TOOLS = Object.freeze(macTools.map((tool) => tool.name));

module.exports = { baseCatalog, catalogNames, WORKFLOW_VIA, MAC_TOOLS };
