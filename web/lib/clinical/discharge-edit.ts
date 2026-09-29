/**
 * Corregir el plan campo a campo.
 *
 * POR QUÉ EXISTE: el panel de plan y egreso juntaba «Dosis y vía» y «Frecuencia y
 * duración» en un solo campo, y al guardarlo escribía `{ dose: valor, route: "" }`
 * y `{ frequency: valor, duration: "" }`. Corregir la dosis BORRABA la vía, y
 * corregir la frecuencia borraba la duración — sin aviso, sobre la receta del
 * paciente. Aquí cada campo escribe SOLO su dato, y todo lo demás del
 * medicamento (incluida la evidencia) queda como estaba.
 *
 * `concentration` y `quantity` existen para la fórmula médica: el Decreto 2200 de
 * 2005 pide concentración y forma farmacéutica y la cantidad total a dispensar.
 * La nota generada no los trae; el médico los escribe.
 */

import type { ClinicalMedicationPlanItem } from "@/lib/api/clinical";

export type MedicationField =
  | "name"
  | "concentration"
  | "dose"
  | "route"
  | "frequency"
  | "duration"
  | "quantity"
  | "instructions";

/** El orden y el rótulo de cada campo, tal como se ven en el editor. */
export const MEDICATION_FIELDS: readonly { field: MedicationField; label: string; placeholder: string }[] = [
  { field: "name", label: "Medicamento", placeholder: "Nombre genérico" },
  { field: "concentration", label: "Concentración", placeholder: "p. ej. 500 mg/tableta" },
  { field: "dose", label: "Dosis", placeholder: "p. ej. 1 tableta" },
  { field: "route", label: "Vía", placeholder: "p. ej. oral" },
  { field: "frequency", label: "Frecuencia", placeholder: "p. ej. cada 8 horas" },
  { field: "duration", label: "Duración", placeholder: "p. ej. 5 días" },
  { field: "quantity", label: "Cantidad total", placeholder: "p. ej. 15 tabletas" },
  { field: "instructions", label: "Indicaciones", placeholder: "p. ej. después de comer" },
];

const CAMPOS = new Set<string>(MEDICATION_FIELDS.map((f) => f.field));

/**
 * La lista con UN campo de UN medicamento cambiado. Un campo que no es del
 * medicamento o un índice fuera de rango devuelven la lista tal cual.
 */
export function updateMedicationField(
  medications: readonly ClinicalMedicationPlanItem[],
  index: number,
  field: MedicationField,
  value: string,
): ClinicalMedicationPlanItem[] {
  if (!CAMPOS.has(field) || index < 0 || index >= medications.length) return [...medications];
  return medications.map((item, i) => (i === index ? { ...item, [field]: value } : item));
}
