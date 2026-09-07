// Preferencias del médico -> el bloque `doctor` que viaja al GENERADOR de nota.
//
// Separado de assistant.ts a propósito: aquel decide qué se le cuenta al
// asistente (nombre, trato, cuánto se extiende al responder); al generador solo
// le importa la extensión de la nota. Mandar el nombre aquí sería ampliar sin
// motivo lo que entra al prompt de la nota.

import type { NoteGenerationDoctorContext } from "@/lib/api/clinical";
import type { UserPreferences } from "./types";

/**
 * Devuelve `undefined` —y no `{}`— cuando no hay nada que decir, para que la
 * petición a generate-note salga sin cuerpo, igual que siempre.
 *
 * "estandar" NO se envía: es exactamente el prompt de hoy, y una preferencia
 * igual al valor de fábrica no es una instrucción. En Graph, además, el valor
 * por defecto no emite nada; mandarlo solo añadiría una línea que repite lo
 * que ya está escrito.
 */
export function buildNoteGenerationContext(
  preferences: UserPreferences,
): NoteGenerationDoctorContext | undefined {
  if (preferences.noteDetail === "estandar") return undefined;
  return { note_detail: preferences.noteDetail };
}
