# Contrato Graph ↔ métricas por consulta

La consola `/superadmin/metricas` (tabla `encounter_metrics` + RPCs
`superadmin_encounter_metrics` / `superadmin_encounter_detail`, migración
`20260827000000`) atribuye consumo de IA a consultas **por `session_id` del
ledger `ai_usage_events`**.

> **Estado: APLICADO en Graph el 2026-08-26** (rama `feat/omi-conexion-plan-b`).
> Este documento pasa de "lo que falta" a "cómo quedó", y sigue siendo la
> referencia de por qué cada pieza está donde está. Lo único pendiente es
> desplegar Graph y tarifar los modelos nuevos (§4).

## 1. `session_id = encounter_id` en eventos con alcance de consulta ✅

Todo evento de `ai_usage_events` que Graph emite al servir una operación de un
encounter clínico lleva `session_id` = el **uuid del encounter** (en texto).
Se hace pasando `{ sessionId: encounter.id }` como tercer argumento de
`withFeature(...)`: `AiUsageRecorder` ya lo tomaba del contexto
(`sessionId: input.sessionId ?? context.sessionId`), así que no hizo falta
tocar ni el recorder ni el ingest. Aplica a:

| feature (actual)        | operación                                   |
|-------------------------|---------------------------------------------|
| `note_generation`       | `ClinicalNoteGeneratorService.generate()`     |
| `asistente`             | ajuste de nota y sugerencias diagnósticas (`ClinicalAssistantService`) |
| `asistente` (chat)      | solo en modo B, cuando el chat trae encounter |

**Lo que NO se ató, a propósito:** el chat clínico general (modo A) y
`/api/clinical/diagnosis-suggestions` no tienen encounter — ponerles una
sesión inventada haría que un costo sin dueño pareciera de alguien. Y el
`field_matching` del cliente Windows ya usa `session_id` para su propia sesión
de voz: son uuids de otra cosa, no colisionan con encounters y se quedan como
están.

Reglas:

- El valor es el `encounter_id` de `clinical_encounters`, tal cual, en texto.
- Si una operación no tiene encounter (p. ej. `organizer_setup`), `session_id`
  se queda como esté hoy. **Nunca** inventar uno.
- No hay backfill posible: los eventos históricos sin `session_id` quedarán
  para siempre como "no atribuibles" y la consola los reporta así en su bloque
  `cobertura`. No es un bug de la consola.

La web ya manda su parte: `POST /api/telemetry/encounter-usage` reporta los
minutos de transcripción en vivo con `feature: "live_transcription"`,
`audioSeconds` y `sessionId = encounter_id` vía el ingest
`/api/internal/usage/events`. El ingest debe aceptar (o seguir aceptando) los
campos `audioSeconds` y `sessionId` del payload y mapearlos a las columnas
`audio_seconds` / `session_id`.

## 2. Diarización en la sesión de Soniox ✅

`_build_soniox_start_message` (integrations/soniox/streaming.py) añade
`"enable_speaker_diarization": true`, gobernado por el ajuste
`voice_stt_diarization` (env `MIRACLE_STT_DIARIZATION`, encendido por defecto).
Con eso los tokens del stream llegan con `speaker` y el motor los reenvía a la
telemetría. Si se apaga:

- **Silencios sí funcionan**: solo requieren `start_ms`/`end_ms`, que Soniox
  manda siempre.
- **Interrogatorio se muestra como "no disponible"** — la fila queda con
  `interrogation_ms = NULL` y la consola lo dice; no se estima.

Las etiquetas de hablante de Soniox **no son estables entre sockets**: la
telemetría guarda el ordinal del stream junto a cada segmento y el cálculo
nunca cruza hablantes de streams distintos, así que la reconexión no
contamina la métrica.

## 3. `deepgram-dictation.js`: la divergencia 5 se subió a Graph ✅

El timing por token (`onFinalTranscript` entrega `tokens: [{speaker?,
start_ms, end_ms}]`, sin texto) nació como divergencia 5 en el portal y **ya
está en `web/public/shared/deepgram-dictation.js` de Graph**. El próximo
re-vendoreo lo trae de serie: solo hay que reaplicar los bloques
`[DIVERGENCIA 4]` (fuente de audio Omi), la cabecera, el `const` del IIFE y el
export.

## 4. Pendiente: tarifar los modelos nuevos

`ai_model_prices` no tiene tarifa para Soniox (ni para `gpt-5.6-terra`,
`gemini-3.1-flash-live-preview`, `gpt-realtime-2.1-mini`), así que sus eventos
salen con `cost_usd` nulo y la consola los muestra como "sin tarifa" — el costo
en dólares es un SUELO, no un total. Los tokens y los minutos sí se miden. No
se inventa un precio: hay que meter las tarifas reales en el catálogo
(`src/domain/usage/pricing.js` + su migración, que `verify-ai-usage-pricing`
mantiene en paridad).

## Verificación

Automática, ya en verde: `node scripts/verify-ai-usage-telemetry.js` cubre la
cadena de atribución (sección "Consumo atribuido a una consulta") y
`pytest tests/test_voice_audio_source.py` la diarización
(`TestSonioxDiarizacion`).

En vivo, cuando Graph despliegue:

1. Generar una nota en la web y consultar:
   `select feature, session_id, total_tokens from ai_usage_events order by occurred_at desc limit 5;`
   → los eventos de la generación deben traer el uuid del encounter.
2. Abrir `/superadmin/metricas/<encounter_id>`: el bloque "Consumo de IA por
   operación" deja de estar vacío.
3. En `/superadmin/metricas`, el aviso de "tokens no atribuibles" debe dejar
   de crecer para consultas nuevas.
4. Con diarización activa: grabar una conversación de dos personas y verificar
   que la fila de `encounter_metrics` tenga `diarization = true` e
   `interrogation_ms` no nulo.
