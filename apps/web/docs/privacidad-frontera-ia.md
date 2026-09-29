# Privacidad hacia la IA: dónde está la frontera y cómo se demuestra

> Decisión D21 en [`decisiones.md`](./decisiones.md). El diseño completo y las
> pruebas viven en Graph: `docs/privacy-egress-gateway.md` de ese repo. Este
> documento es la vista desde la web: qué sale de aquí, qué afirma la pantalla
> y qué NO cubre.

## La frase que queremos poder sostener

> «Antes de enviar texto de una consulta a un proveedor externo de IA, Miracle
> reemplaza dentro de su propia infraestructura los identificadores directos del
> paciente (nombre, documento, teléfono, correo y dirección) por marcadores sin
> significado; el proveedor trabaja sólo con esa representación, y los datos
> reales se reconstruyen únicamente dentro de Miracle antes de guardar la nota,
> mostrarla al médico o llevarla al sistema del hospital. Cada envío queda
> registrado con el resultado de esa protección.»

**No se usa comercialmente** hasta que el escudo esté en modo `enforce` en Graph
para generación, asistente y emparejamiento, y `scripts/evidencia-privacidad.js`
(Graph) lo demuestre sobre consultas reales.

## Dónde ocurre la protección (y por qué no en el navegador)

La protección vive en **Graph**, en el último salto antes del proveedor
(`LLMProvider.postChatCompletions` y el salto al runtime Python). Por debajo de
ese salto no hay ningún punto de persistencia, así que todo lo que Miracle
guarda —la nota del taller, la versión de la IA, el espejo en `consultations`, el
snapshot de exportación y los valores que Operations escribe en SAP— lleva los
datos reales.

Esta web tuvo un redactor propio (`lib/privacy/redact.ts`, retirado el
2026-09-07). Tres razones para no volver a él:

1. **Estaba apagado desde el 2026-07-21** (`REDACTION_ENABLED = false`) porque
   su `[NUMERO]` era irreversible y el médico perdía la cédula en la
   transcripción. Mientras tanto, tres pantallas afirmaban «datos protegidos».
2. **Solo tapaba al paciente registrado y asociado**, que casi nunca lo está:
   la casilla `identificacion_del_paciente` existe justamente porque el nombre
   se dicta y no se registra.
3. **Guardaba placeholders en Graph.** Graph publica `consultations` desde el
   servidor y congela el snapshot de exportación desde ahí: los placeholders
   habrían llegado a SAP.

## Qué sale de esta web hacia fuera, hoy

| Canal | Qué sale | Hacia | Protección |
|---|---|---|---|
| Transcripción y nota (`lib/api/clinical.ts`) | texto real | Graph (infraestructura de Miracle) → escudo → proveedor de IA | **escudo de Graph** |
| Asistente (chat, ajuste, sugerencias) | mensaje, historial, instrucción | Graph → escudo → proveedor | **escudo de Graph** |
| Audio de la consulta (`lib/stt/*`) | audio crudo, por WebSocket con token efímero | Deepgram / Soniox | **ninguna posible sobre el audio**; contrato de encargado (pendiente, legal) |
| Foto del horario (`app/api/parse-schedule`) | imagen con nombres y documentos de la agenda | Anthropic, directo | **ninguna**: la función existe para extraer esos datos. Excepción declarada; alternativa pendiente: importación por texto/CSV sin IA |
| Nota desde foto (`app/api/clinical/note-from-photo`) | foto de hoja manuscrita con nombre y cédula | Graph → proveedor de visión | **ninguna** sobre la imagen. Excepción declarada; a futuro OCR local + escudo de texto |
| Plantilla desde foto, categorizar atajos | foto de formulario; texto de atajos | Anthropic, directo | solo por prompt. Pendiente: mover a Graph bajo el escudo |
| Telemetría (`lib/ai-usage.ts`, `encounter-usage`) | números y etiquetas | Graph | no lleva texto |

## Qué afirma la pantalla, y de dónde sale

La insignia de la consulta en vivo y el bloque «Privacidad» del panel de
auditoría se pintan con `describePrivacySummary` (`lib/clinical/privacy-summary.ts`)
a partir de `privacy`, que devuelve Graph en `generate-note`, en el ajuste y en el
chat, o del ledger (`GET /api/clinical/encounters/:id/privacy`). Conteos y
estados, nunca valores:

| El servidor dice | La pantalla dice |
|---|---|
| nada todavía | «La protección hacia la IA se certifica al generar la nota» |
| `mode: shadow` | «Sin protección activa (modo sombra)» |
| `mode: enforce`, tokens `{PACIENTE_NOMBRE: 2, DOCUMENTO: 1}` | «Protegido antes de enviar a la IA: 2 nombres, 1 documento» |
| `rehydration: incomplete` o `posthoc_leak: true` | lo anterior, en tono de advertencia y con el motivo |

`tests/privacy-claims.test.ts` fija la regla: sin dato del servidor no se afirma
nada, y ninguna pantalla puede volver a tener un texto fijo de «protegido».

## Lo que sigue siendo verdad aquí

- La transcripción **no se modifica**: es la evidencia de lo que se dijo.
- El documento se canoniza en el borde (`canonicalizeNoteIdentity`), después de
  que la nota vuelve con los datos reales (D19 no cambia).
- La firma cubre la nota real (`signature-hash.ts`): rehidratar antes de firmar
  queda garantizado porque la rehidratación ocurre en Graph antes de persistir.
- Asociar al paciente registrado sigue valiendo la pena: es la semilla exacta
  con la que Graph tapa desde la primera llamada, además de lo que detecta en el
  dictado.

## Lo que NO cubre (registro de excepciones)

| | Estado | Decisión pendiente (dueño: producto/legal) |
|---|---|---|
| Audio → proveedor de voz | necesario para transcribir; sin retención en Miracle | contrato de encargado sin retención, o STT propio/en región |
| Fotos → modelos de visión (horario, hoja de patología, formulario) | imagen: no hay texto que tapar | declarar en el ledger; importación por texto para la agenda; OCR local a futuro |
| Puente consciente de Operations (capturas de pantalla), video de enseñanza, voz en vivo de Ü, nube de Omi | fuera del flujo de Notes | fase propia en Graph y rama propia en Windows |

`legal-colombia.md` §4: la transferencia internacional incluye a estos
proveedores, no solo a Supabase.
