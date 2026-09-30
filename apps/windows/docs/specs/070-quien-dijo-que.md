# Spec 070 — Quién dijo qué: la voz viaja con el texto hasta la nota

> 2026-09-29 · rama `jose/diarizacion-sencilla` · cruza tres proyectos: `apps/web`, `apps/windows`,
> `services/graph`. Es la fase 1 del plan de diarización (`docs/plan-diarizacion.md` de la sesión
> del 2026-09-28). **Sin enrolamiento de voz**: nadie tiene nombre, solo «Hablante N».

## El problema, medido

Graph le pide a Soniox `enable_speaker_diarization: true` desde hace semanas
(`services/graph/bounded/miracle-ai/.../soniox/streaming.py:131`), y en producción hay 603 consultas
con `encounter_metrics.diarization = true`. Pero la etiqueta se pierde antes de la nota:

| Sitio | Qué hace con `speaker` |
|---|---|
| `apps/web/lib/stt/deepgram-dictation.js` (y su original en `services/graph/web/public/shared/`) | lo guarda en un arreglo **sin texto**, solo para telemetría |
| `apps/web/lib/stt/transcribe-audio-file.ts` | lo ignora |
| `apps/windows/.../Transcripcion/LectorSoniox.cs` | lo ignora |

Cuatro archivos parsean tokens de Soniox (el vendido cuenta dos veces) y **ninguno** entrega el
hablante junto al texto. El prompt de la nota (`ClinicalNotePromptBuilder.js:36,41`) le pide al
modelo que adivine quién habla, y no dice que lo del médico manda.

## Qué se promete

La etiqueta viaja **dentro del mismo texto**, sin columna nueva: una línea que empieza con
`[Hablante N]` cada vez que cambia la voz. La numeración es por orden de aparición, y la voz de un
socket nuevo (reconexión) nunca se funde con la de otro: Soniox renumera en cada socket, así que
fundirlas por número sería inventar que son la misma persona. Mejor un hablante de más que uno mal
unido.

| # | Promesa | Juez |
|---|---|---|
| 600 | Con dos o más hablantes, el prompt de la nota explica las etiquetas y ordena deducir por el contexto quién es el médico y quién el paciente o acompañante. | `services/graph/scripts/verify-diarizacion.js` |
| 601 | Lo que dice el médico manda: el prompt interpretativo lo declara fuente de mayor autoridad — si el paciente dice una cosa y el médico la corrige, vale la del médico; lo que solo dice el paciente es referido, nunca hallazgo. | ídem |
| 602 | Con un solo hablante, la transcripción llega al modelo sin etiquetas, igual que antes de esta spec. | ídem |
| 603 | El escudo de privacidad deja las etiquetas intactas. | ídem |
| 604 | El motor de dictado del navegador entrega, con cada frase final de Soniox, sus turnos `{speaker, text}`. | `apps/web/tests/speaker-turns.test.ts` |
| 605 | El etiquetador pone `[Hablante N]` solo al cambiar de voz, numera por aparición, y un socket nuevo no se funde con el anterior. | ídem |
| 606 | La transcripción de un archivo subido también lleva sus hablantes. | ídem |
| 607 | En Windows, el hablante de Soniox viaja con el texto al verbatim que va al backend. | `apps/windows/tests/ContratoDelGrafo/Contrato.cs` |
| 608 | La vista de voces de la web parte la transcripción en turnos: cada `[Hablante N]` abre uno, lo que sigue sin etiqueta es de la misma voz, lo de antes de la primera voz no es de nadie, y la parte de lo dicho de cada voz suma 100. | `apps/web/tests/speaker-turns.test.ts` |
| 609 | Lo mismo en la ventana de consulta de Windows. | `Contrato.cs` |

La vista (pedida el 2026-09-29, a mitad de la rama): en la web, bajo la transcripción, un panel
«Quién habla» con una fila por turno —avatar y nombre de la voz en su color— y una pastilla por voz
con su parte de lo dicho; en Windows, lo mismo en lugar del texto corrido mientras se graba. La
parte se mide en **caracteres transcritos**, no en tiempo, y la vista lo dice: el tiempo por voz
vive en `encounter_metrics` y no llega a la pantalla.

## Fases

| Fase | Pone verde | Toca |
|---|---|---|
| 1 | 600-603 | `services/graph/src/domain/clinical/speakerLabels.js`, `ClinicalNotePromptBuilder.js` |
| 2 | 604-606 | `deepgram-dictation.js` (los dos), `lib/stt/speaker-turns.ts`, `useDictation.ts`, `en-vivo/page.tsx`, `transcribe-audio-file.ts` |
| 3 | 607 | `Verbatim.cs`, `LectorSoniox.cs` |
| 4 | 608-609 | `speaker-turns.ts` + `components/app/SpeakerConversation.tsx`; `TurnosDeVoz.cs` + `Ui/VocesEnVivo.cs` |

## Lo que queda fuera

- Poner nombre a una voz (enrolamiento): fase 2 del plan.
- `consultations.transcript` sigue siendo un turno sin hablante: el espejo (`ConsultationMirrorService.js`,
  `encounter-to-consultation.ts`, `EspejoDeConsulta.cs`) copia el texto, ya con las etiquetas dentro.
- Deepgram: no pide `diarize`; si se conmuta a Deepgram, el texto sale sin etiquetas, como hoy.
- Mac: no usa Soniox todavía.
