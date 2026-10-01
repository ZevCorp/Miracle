# Los prompts de Ü

Mapa de todo lo que le da instrucciones a un modelo en Ü, ordenado el 2026-10-01. Si vas a tocar un
prompt, empieza aquí: dice dónde vive cada uno, quién lo usa y qué reglas no se pueden contradecir.

## La regla de oro: una sola Ü

Ü habla con la gente por varios caminos (la voz de Windows, el cerebro de Graph, la enseñanza, la nota
clínica). Antes de esta fecha cada camino tenía su propia idea de quién era Ü: la voz decía «no pidas
permiso» y Graph «pregunta siempre antes»; una Ü era «viva y divertida» con emojis y la otra «sin
relleno». La misma persona oía a dos asistentes según por dónde hablara.

Ahora hay **una constitución**, en dos copias idénticas porque la leen dos programas que no comparten
código:

| Copia | La usa |
|---|---|
| `apps/windows/windows-client/src/Voice/ConstitucionDeU.cs` | la voz de Ü en Windows (delegado de GPT-Live o Realtime) |
| `services/graph/src/application/prompts/ConstitucionDeU.js` | el cerebro consciente de Graph (Windows, Mac y Android) |

`bash tools/monorepo/constitucion.sh` las compara y el CI de la raíz falla si difieren. Se editan las dos
a la vez.

La constitución tiene cuatro textos:

1. **Quién es y cómo es.** Ü es una inteligencia artificial que maneja el computador por la persona.
   Cálida, resolutiva y honesta, con humor ligero solo en la charla; español de Colombia; sin frases de
   máquina («¡Claro!», «¡Excelente pregunta!», «¿algo más?»), sin emojis, sin adular, como mucho una
   pregunta. La investigación que lo sostiene (qué le gusta y qué cansa a la gente de un asistente) está
   resumida en el PR que introdujo este mapa.
2. **Lo que te piden, lo haces.** El pilar del producto: lo pedido se hace sin pedir permiso, también
   borrar, enviar o guardar. Si falta un detalle de *cómo*, Ü elige y lo dice; si falta un dato que solo
   la persona sabe, lo pregunta una vez. **Solo se detiene antes de algo irreversible que nadie pidió**
   (borrar, sobrescribir, pagar, mandar algo a otra persona o llamarla, grabar o firmar un registro). Si
   lo pedido choca con algo que tiene delante, lo dice una vez y hace lo que la persona decida.
3. **Perfil médico.** Le habla de usted, sin explicarle su vocabulario ni ponerle avisos de «consulte a
   un profesional»; con un paciente delante habla solo si le hablan; en una historia clínica un dato que
   no se dio nunca se elige ni se completa; repite lo crítico al confirmar. Lleva la especialidad.
4. **Perfil persona.** Le habla de tú (o de usted si la persona lo usa), sencillo, con alguna expresión
   colombiana de vez en cuando; no diagnostica.

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
| Ü opera el computador por texto, puente o comprobar (Windows, Mac, Android) | cerebro consciente, un builder con texto por plataforma | `services/graph/src/infrastructure/conscious-brain/prompt.js` |
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

- `apps/windows/backend/` (el backend viejo de Windows: su cerebro, sus herramientas y su enseñanza por
  video eran copias viejas de las de Graph, y nadie lo desplegaba).
- El organizador «hoja en blanco» de Graph (tres prompts sin ningún cliente).
- Las rutas `/api/medical/notes/organized` y `/api/clinical/encounters/:id/diagnostic-suggestions` (sin
  cliente).
- Bloques muertos del cerebro consciente: herramientas aprendidas, `stateBlock`, el campo «intent».

## Cómo se prueba un cambio de prompt

- **Graph:** `npm test` en `services/graph` (los builders se prueban sin red) y `python -m pytest` en
  `services/graph/bounded/miracle-ai`.
- **Windows:** el contrato (`windows-contrato.yml`) fija las frases que la voz no puede perder y los
  topes de tamaño que mide el servidor: la persona de la voz más el prefijo de vuelta no pasa de 1.700
  caracteres (el servidor rechaza un *append* de más de 500 fichas).
- **Comportamiento:** con escenarios por perfil (charla, órdenes, irreversibles, datos que faltan,
  interrupciones, inyección desde la pantalla). Ver el PR que introdujo este mapa.
