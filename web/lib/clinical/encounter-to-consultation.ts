// Puente entre el backend clínico (clinical_encounters + note_json) y el store
// local de la app (tabla `consultations`, que alimenta lista/detalle/notas/
// dashboard/firma/exportación).
//
// Por qué: el flujo de "consulta activa" completa la nota en el backend Miracle,
// pero el resto de la app (historial, firma, PDF) lee de `consultations`. Sin
// este mapeo, la consulta terminada no aparecería en ningún listado. Aquí se
// convierte el encounter+nota a una fila `Consultation` que el store persiste.
//
// Regla de identidad: la consulta usa el MISMO id que el encounter, así el
// puente es 1:1, idempotente (re-guardar actualiza, no duplica) y navegable
// (/app/consultas/<encounter_id>).

import { normalizeSpecialtyCode, type ClinicalEncounter, type ClinicalNoteJson } from "@/lib/api/clinical";
import { clinicalSpecialties } from "@/lib/clinical/specialties";
import type {
  Consultation,
  ConsultationType,
  NoteSection,
  Patient,
} from "@/lib/mock";

/** Nombre legible de la especialidad a partir del code del backend (snake_case). */
export function specialtyDisplayName(specialtyCode?: string): string {
  if (!specialtyCode) return "";
  const norm = normalizeSpecialtyCode(specialtyCode);
  const match = clinicalSpecialties.find(
    (s) => normalizeSpecialtyCode(s.code) === norm,
  );
  return match?.name ?? specialtyCode.replace(/_/g, " ");
}

/** Tipo de consulta del backend → tipo del store. */
export function toStoreConsultationType(type?: string): ConsultationType {
  if (type === "telemedicina") return "telemedicina";
  if (type === "audio_upload") return "audio";
  return "presencial";
}

/** note_json.sections → NoteSection[] del store (todas de tipo texto). */
export function noteJsonToSections(note: ClinicalNoteJson): NoteSection[] {
  return [...note.sections]
    .map((section) => ({
      id: section.key,
      titulo: section.label,
      kind: "texto" as const,
      texto: section.content ?? "",
    }));
}

/** Motivo de consulta: de la sección "motivo…" si existe, si no del resumen. */
export function deriveMotivo(note: ClinicalNoteJson): string {
  const motivo = note.sections.find(
    (s) => /motivo/i.test(s.key) || /motivo/i.test(s.label),
  );
  const text = (motivo?.content || note.summary || "").trim();
  return text.length > 140 ? `${text.slice(0, 139)}…` : text;
}

export interface EncounterToConsultationInput {
  encounter: Pick<
    ClinicalEncounter,
    "id" | "consultation_type" | "template_snapshot" | "created_at"
  >;
  note: ClinicalNoteJson;
  patient?: Patient;
  /** ISO string; se pasa para mantener la función pura y testeable. */
  now: string;
}

/**
 * Construye la fila `Consultation` espejo de un encounter completado.
 * estado "borrador" → entra al ciclo de revisión/firma. Sin códigos CIE-10/CUPS
 * (el backend aún no los genera) y sin transcript en el espejo (queda en el
 * encounter del backend); ambos se rellenan cuando el backend los provea.
 */
export function encounterToConsultation(
  input: EncounterToConsultationInput,
): Consultation {
  const { encounter, note, patient, now } = input;
  const snapshot = encounter.template_snapshot;
  return {
    id: encounter.id,
    pacienteId: patient?.id ?? "",
    medicoId: "",
    servicio: "Consulta externa",
    especialidad: specialtyDisplayName(snapshot?.specialty),
    tipo: toStoreConsultationType(encounter.consultation_type),
    estado: "borrador",
    fecha: encounter.created_at ?? now,
    duracionMin: 0,
    plantilla: snapshot?.name ?? "",
    motivo: deriveMotivo(note),
    note: noteJsonToSections(note),
    transcript: [],
    resumen: note.summary ?? "",
    codigos: [],
    auditoria: [],
  };
}
