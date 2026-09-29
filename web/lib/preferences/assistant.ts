// Preferencias del médico -> el bloque `doctor` que viaja al asistente.
//
// Existe para que haya UN solo sitio donde se decide qué se le cuenta al
// asistente sobre el médico. Lo consumen el chat clínico y el ajuste de nota; si
// cada uno lo armara por su cuenta, tarde o temprano uno mandaría el nombre
// completo y el otro el de pila, o uno respetaría "no uses mi nombre" y el otro
// no.

import type { AssistantDoctorContext } from "@/lib/api/clinical";
import type { UserPreferences } from "./types";

/** Tope defensivo; el backend recorta igual, pero no se manda basura a propósito. */
const MAX_NOMBRE = 80;

/**
 * Devuelve `undefined` —y no un objeto vacío— cuando no hay nada que decir, para
 * que la clave sencillamente no viaje en el payload.
 *
 * `assistantDetail: "equilibrado"` NO se envía: el system prompt del backend ya
 * dice "evita respuestas largas si el médico hizo una pregunta simple", así que
 * mandarlo solo añadiría una línea que repite lo que ya está escrito.
 *
 * El trato SÍ se envía siempre, aunque sea el valor de fábrica, y la diferencia
 * importa: sobre tú/usted el prompt no dice nada, de modo que sin esta línea el
 * modelo alterna entre los dos según le venga. Aquí no se está repitiendo una
 * regla, se está fijando una que no existía.
 */
export function buildDoctorContext(
  preferences: UserPreferences,
  firstName: string | null,
): AssistantDoctorContext | undefined {
  const doctor: AssistantDoctorContext = {};

  if (preferences.assistantUseName && firstName) {
    doctor.display_name = firstName.slice(0, MAX_NOMBRE);
  }
  if (preferences.assistantAddress) {
    doctor.address = preferences.assistantAddress;
  }
  if (preferences.assistantDetail !== "equilibrado") {
    doctor.detail = preferences.assistantDetail;
  }

  return Object.keys(doctor).length ? doctor : undefined;
}
