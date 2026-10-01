# Los prompts de Ü

Mapa de todo lo que le da instrucciones a un modelo en Ü, ordenado el 2026-10-01. Si vas a tocar un
prompt, empieza aquí: dice dónde vive cada uno, quién lo usa y qué reglas no se pueden contradecir.

## La regla de oro: una sola Ü

Ü habla con la gente por varios caminos (la voz de Windows, el cerebro de Graph, la enseñanza, la nota
clínica). Antes de esta fecha cada camino tenía su propia idea de quién era Ü: la voz decía «no pidas
permiso» y Graph «pregunta siempre antes»; una Ü era «viva y divertida» con emojis y la otra «sin
relleno». La misma persona oía a dos asistentes según por dónde hablara.

Ahora hay **una constitución**, en tres copias idénticas porque la leen tres programas que no comparten
código:

| Copia | La usa |
|---|---|
| `apps/windows/windows-client/src/Voice/ConstitucionDeU.cs` | la voz de Ü en Windows (delegado de GPT-Live o Realtime) |
| `services/graph/src/application/prompts/ConstitucionDeU.js` | el cerebro consciente de Graph (Windows, Mac y Android) |
| `apps/android/core/src/commonMain/kotlin/graph/core/domain/ConstitucionDeU.kt` | el cerebro local de Android (OpenAI o Gemini desde el teléfono, el proveedor por defecto de la app) |

`bash tools/monorepo/constitucion.sh` compara las de Windows y Android con la de Graph, y el CI de la raíz
falla si difieren. Se editan las tres a la vez.

La constitución tiene cuatro textos (versión `constitucion-de-u@2026-10-01.2`):

1. **Quién es y cómo es.** Ü es una inteligencia artificial que vive en el computador o el celular de la
   persona y lo maneja por ella. Cálida, resolutiva y honesta, con humor ligero solo en la charla; español
   de Colombia (nunca «vos», «vale» ni «ordenador»); sin frases de máquina («¡Claro!», «¡Excelente
   pregunta!», «¿algo más?»), sin emojis, sin adular, como mucho una pregunta. Devuelve el saludo que le
   dan y no supone la hora; si le piden un chiste, uno corto y blanco.
2. **Lo que te piden, lo haces.** El pilar del producto: lo pedido se hace entero y sin pedir permiso,
   también borrar, enviar o guardar. Las únicas paradas, cada una con su forma de preguntar:
   - un detalle de *cómo* (carpeta, nombre, formato): Ü elige y lo dice al terminar;
   - un dato que solo la persona sabe: lo busca primero en lo que ya le contaron y en su memoria, y si no
     está, pregunta **un** dato, una vez, con la razón delante;
   - algo irreversible que **nadie** pidió (borrar, sobrescribir, pagar, mandar algo a otra persona o
     llamarla, grabar o firmar un registro): pregunta una vez con el dato clave;
   - **llenar no es enviar**: si le piden llenar algo y no dijeron enviarlo, grabarlo ni firmarlo, lo deja
     lleno y pregunta una vez al final;
   - lo pedido **choca** con lo que tiene delante (otro nombre, otra cifra): para antes de ese paso y le
     devuelve la decisión en la misma frase.
   Si pregunta y no le contestan, no inventa el dato ni hace lo irreversible: hace lo que no dependa de eso
   y dice qué falta. Las contraseñas, claves del banco y datos de tarjeta los escribe la persona.
3. **Perfil médico.** Le habla de usted; «doctor» o «doctora» solo al saludar o despedirse y solo si sabe
   cuál; sin explicarle su vocabulario ni avisos de «consulte a un profesional». Con un paciente delante
   habla solo si le hablan, pero lo que no cuadra y la confirmación de lo crítico sí se dicen. En una
   historia clínica un dato que no se dio queda vacío y se dice como resultado. Lo que no cuadra (otro
   paciente, una alergia, una dosis) para antes y le devuelve la decisión. Los datos de un paciente no van
   a la memoria de Ü. Lleva la especialidad.
4. **Perfil persona.** Le habla de tú, nunca de vos (de usted si la persona lo usa), sencillo, con alguna
   expresión colombiana de vez en cuando; no diagnostica.

La voz de GPT-Live (la que suena) lleva una persona corta con lo mismo, medida para caber en la vuelta de
un modo (`ProtocoloGptLive.InstruccionesDeLaVoz`, 1.283 caracteres) y una frase por perfil
(`ConstitucionDeU.VozMedico` / `VozPersona`). Delega antes de comentar, no anuncia lo que va a hacer, y
**mientras se trabaja acompaña**: le llegan avances de lo que su equipo ya hizo y cuenta, en pasado, lo que
aporte (spec 073; hasta el 2026-10-01 decía «mientras se hace el trabajo, calla», y callaba 12 s). Sabe que
ve la pantalla por su equipo, cuenta los resultados con los datos del delegado sin añadirles nada, y
distingue «espera» (calla y escucha) de «apaga la voz» (lo delega).

Quien actúa recibe las instrucciones de siempre —la constitución y la operación de Windows— y, **detrás**,
lo que la conversación le añade (`ConversacionEnVivo.LoQueSeAnade`): las habilidades (cómo se hace algo a la
manera de esta persona, spec 074) y, cuando otro habla por él (GPT-Live), que él no habla y devuelve el
resultado (spec 073) y que ya ve la pantalla del momento del pedido (spec 079). Después van la fecha, lo
aprendido, la memoria y el hilo.

El repaso de la sesión (`Voice/ElRepaso.cs`, `gpt-6-luna`) lee el diario al cerrar la voz y propone qué se
queda: habilidades, preferencias, datos. El código solo aplica lo que trae una cita literal de la persona.
**Con un médico no guarda datos** y sus reglas dicen que nada de un paciente entra en lo que se aprende.

## Médico o persona: dónde se decide

Ü pregunta al inicio, en la ventana de bienvenida de Windows, si se usa para el trabajo en salud o para
el día a día (con la especialidad, si es salud). Quien entra con una cuenta Miracle es médico, con la
especialidad de su cuenta, sin preguntar. Las instalaciones que ya existían lo preguntan una vez.

El perfil viaja a Graph como `profile: { kind, specialty, specialtyName }` en `/api/v1/agent/turn`,
`/api/v1/teach/process-video` y `/api/v1/teach/interpret-steps`. Sin perfil, todo funciona como antes:
la constitución sin el bloque «QUIÉN TE HABLA».

## Un prompt por funcionalidad

| Funcionalidad | Prompt | Dónde vive |
|---|---|---|
| Ü opera el computador por voz (Windows) | persona de la voz (la que habla) + instrucciones del delegado | `voz/Realtime/ProtocoloGptLive.cs` · `windows-client/src/Voice/ConversacionEnVivo.cs` |
| Ü aprende de cada sesión (Windows) | el repaso: qué es habilidad, qué preferencia, qué dato; con un médico, sin datos | `windows-client/src/Voice/ElRepaso.cs` |
| Ü opera el computador por texto, puente o comprobar (Windows, Mac, Android) | cerebro consciente, un builder con texto por plataforma | `services/graph/src/infrastructure/conscious-brain/prompt.js` |
| Ü opera el teléfono sin pasar por Graph (Android, proveedor OpenAI o Gemini) | el mismo texto de Android que Graph, copiado; más las herramientas aprendidas, que solo existen en local, y el toque largo de Gemini (`long_press`), que solo tiene el entorno `mobile` | `apps/android/core/src/commonMain/kotlin/graph/core/domain/PromptDelCerebroLocal.kt` (spec 009 de Android) |
| Manos rápidas (Jev) | una pregunta de peligro, la misma en Windows y Graph | `u/Nucleo/Jev.cs` · `Decision/PeticionASystemOne.cs` · `services/graph/src/domain/decisor/peticionSystemOne.js` |
| Enseñar una tarea | video (Gemini) e interpretación de pasos, con un mismo desempate: ante la duda, es dato de la corrida | `services/graph/src/infrastructure/teach/GeminiVideoClient.js` · `src/domain/teach/interpretarPasos.js` |
| Título y modos de un workflow | WF-DESCRIBE, mismo desempate | `services/graph/src/application/use-cases/WorkflowExecutionGuideBuilder.js` |
| Nota clínica | un generador con modos (interpretativo, literal) | `services/graph/src/application/use-cases/ClinicalNotePromptBuilder.js` |
| Borrador de voz para el triage de SAP | orquestador Python (borrador provisional, no la nota) | `services/graph/bounded/miracle-ai/…/note_orchestrator_adapter.py` |
| Copiloto clínico | chat, diferenciales y ajuste de nota | `services/graph/src/application/use-cases/ClinicalAssistantPromptBuilder.js` |
| Leer documentos clínicos | patología (Graph) · estudios de cardiología e historia (Windows) | `BiopsyExtractionService.js` · `windows-client/src/Cardio/` |
| Llenar formularios y workflows en página | asistente de captura, campos de la nota, valores dinámicos, ajuste en marcha | `services/graph/src/application/use-cases/` |

Las reglas que comparten los prompts clínicos (no inventar, fidelidad de cifras, la frase única
«No mencionado en la consulta.», solo JSON, límite de rol) viven en
`services/graph/src/application/prompts/PromptClauses.js`, con su espejo de versión en Python.

## Lo que se borró el 2026-10-01

- El organizador «hoja en blanco» de Graph (tres prompts sin ningún cliente).
- Las rutas `/api/medical/notes/organized` y `/api/clinical/encounters/:id/diagnostic-suggestions` (sin
  cliente).
- Bloques muertos del cerebro consciente: herramientas aprendidas, `stateBlock`, el campo «intent».
- Del catálogo de Windows, `map_places` y `map_routes_from`: Graph las declaraba y U.exe no las ejecuta.

**Pendiente de borrar:** `apps/windows/backend/` (el backend viejo de Windows: su cerebro, sus
herramientas y su enseñanza por video son copias viejas de las de Graph, y nadie lo despliega). Hay que
borrarlo con `git rm -r apps/windows/backend` junto con las referencias que lo nombran en la
documentación de Windows; no se hizo en esta rama.

## Lo que las herramientas hacen de verdad

Las descripciones de herramientas también son prompt, y en esta fecha varias prometían lo que el cliente
no hace. Ahora cada una dice lo que hace en su plataforma:

- `send_email`, `send_sms`, `dial`: dejan el mensaje o la llamada listos, **no** envían ni llaman, ni
  adjuntan archivos. Si se lo pidieron, Ü termina en la pantalla (Enviar, Llamar) y comprueba.
- Windows: `set_alarm`, `set_timer` y `create_event` solo abren Reloj o Calendario; `share_text` solo
  copia al portapapeles.
- `web_search`: abre la búsqueda y no devuelve resultados; un dato solo se da si se leyó en la pantalla.
- `check_simit_fines`: si piden pagar, Ü llega con el comparendo hasta la pasarela oficial y ahí sigue la
  persona; si piden radicar el derecho de petición, lo radica en el canal oficial con sus datos.
- Un workflow aprendido hace TODOS sus pasos, también guardar: nunca se llama para solo abrir una app, y
  el teléfono no recibe los workflows grabados en el PC (ni al revés).

## Cómo se prueba un cambio de prompt

- **Graph:** `npm test` en `services/graph` (los builders se prueban sin red) y `python -m pytest` en
  `services/graph/bounded/miracle-ai`.
- **Android:** el contrato de `apps/android` (`scripts/contrato.sh`, promesas 901-911) juzga la constitución del
  núcleo, el orden y las prohibiciones del prompt local, que cada turno lleve `<pantalla>`, que cada llamada reciba el
  resultado de su acción, el formato de la memoria y lo que el motor narra o informa. Los bloques de Android
  del prompt local se copian de `prompt.js` a mano: si Graph los cambia, se vuelven a copiar.
- **Windows:** el contrato (`windows-contrato.yml`) fija las frases que la voz no puede perder y los
  topes de tamaño que mide el servidor: la persona de la voz más el prefijo de vuelta no pasa de 1.700
  caracteres (el servidor rechaza un *append* de más de 500 fichas).
- **Comportamiento:** con escenarios por perfil (charla, órdenes, irreversibles, datos que faltan,
  interrupciones, inyección desde la pantalla), contestados por un modelo fuerte y uno pequeño con el
  prompt ensamblado de verdad, un juez por pilares y una lectura adversarial que busca reglas que se
  contradicen. Lo que más falla en un modelo pequeño: dar por hecho lo que solo quedó listo (un correo en
  borrador), inventar el resultado de una búsqueda, suponer «doctor» o «doctora», y no devolverle la
  decisión a la persona cuando algo no cuadra.
