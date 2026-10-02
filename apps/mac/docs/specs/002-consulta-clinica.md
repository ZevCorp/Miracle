# Spec 002 — la ventana de la consulta

La consulta clínica del Mac sigue el contrato del portal y el comportamiento descrito en
`docs/plan-mac-del-medico/PLAN.md`, sección 4. La plantilla «Nota abierta (Ü)» se resuelve sola; el
médico no elige una plantilla.

| # | Promesa | Juez |
|---:|---|---|
| 201 | La plantilla abierta se encuentra por nombre, sin depender del orden del catálogo. | `testClinicalTemplateIsAutomaticAndNamed` |
| 202 | Sin una sesión de médico no se crea consulta ni se abre el micrófono. | `testClinicalCannotStartWithoutAuthenticatedDoctor` |
| 203 | Si el dictado no abre, la consulta no queda en `recording` y explica qué hacer. | `testClinicalDoesNotBecomeRecordingWhenDictationFails` |
| 204 | Una consulta válida guarda la transcripción y genera una nota organizada. | `testClinicalStartAndStopProduceOrganizedNote` |
| 205 | Una transcripción vacía falla antes de llamar al backend clínico. | `testClinicalEmptyTranscriptFailsBeforeBackendTranscriptCall` |
| 206 | Si falla el espejo al portal, la nota permanece disponible y el fallo se puede mostrar. | `testClinicalPortalMirrorFailureDoesNotDiscardNote` |
| 207 | La generación de nota se puede reintentar sobre el mismo encounter. | `testClinicalNoteGenerationCanRetrySameEncounter` |
| 208 | Los cambios de estado no contienen texto clínico en sus eventos de diagnóstico. | `testClinicalStateChangeNeverLogsClinicalText` |

La interfaz visual, la sesión Miracle, la transcripción en vivo y el espejo Supabase completan estas
promesas en las siguientes iteraciones de esta misma spec; no se consideran terminadas por la mera
existencia de este núcleo.
