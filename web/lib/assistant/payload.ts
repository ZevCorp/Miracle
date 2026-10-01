// Arma el payload del chat clínico a partir del contexto publicado por la
// página. Puro: sin React, sin red. Es el ÚNICO sitio que decide qué viaja a
// Graph sobre la consulta, y por eso los topes viven aquí.
//
// Lo que NUNCA viaja: nombre, documento, teléfono ni dirección del paciente
// como campos propios. Lo que esté escrito dentro de la nota lo tapa el escudo
// de Graph (docs/privacidad-frontera-ia.md).

import {
  normalizeSpecialtyCode,
  type AssistantChatMessage,
  type AssistantChatPayload,
  type AssistantCodeContext,
  type AssistantDoctorContext,
  type AssistantNoteDraft,
  type AssistantPatientContext,
  type ClinicalNoteJson,
} from "@/lib/api/clinical";
import type { ClinicalCode, NoteSection, Patient } from "@/lib/mock/types";

/** Topes defensivos; Graph recorta igual, pero no se manda de más a propósito. */
export const MAX_DRAFT_SECTION_CHARS = 8000;
export const MAX_DRAFT_TOTAL_CHARS = 20000;
export const MAX_DRAFT_SUMMARY_CHARS = 2000;
export const MAX_HISTORY_TURNS = 12;
export const MAX_HISTORY_CHARS = 4000;
export const MAX_CODES = 20;
export const MAX_CODE_DESCRIPTION_CHARS = 160;
export const MAX_MESSAGE_CHARS = 8000;

/** Lo que el payload necesita del contexto (sin funciones). */
export interface AssistantPayloadContext {
  encounterId: string | null;
  specialtyCode: string | null;
  note: ClinicalNoteJson | null;
  codes: AssistantCodeContext[];
  patient: AssistantPatientContext | null;
  editable: boolean;
}

/** `- ítem` por línea: así una sección de lista del historial viaja como texto. */
export function flattenListItems(items: string[] | undefined): string {
  return (items ?? [])
    .map((item) => `${item ?? ""}`.trim())
    .filter(Boolean)
    .map((item) => `- ${item}`)
    .join("\n");
}

/**
 * La nota del historial (`consultations.note`, NoteSection[]) con la forma
 * del backend, para que el detalle de la consulta publique el mismo contexto
 * que la consulta en vivo.
 */
export function consultationNoteToClinicalNote(
  sections: NoteSection[],
  resumen: string,
): ClinicalNoteJson {
  return {
    summary: resumen ?? "",
    sections: sections.map((section) => ({
      key: section.id,
      label: section.titulo,
      content: section.kind === "lista" ? flattenListItems(section.items) : (section.texto ?? ""),
    })),
    warnings: [],
    missing_required_sections: [],
  };
}

/** Borrador para Graph: solo key/label/content, con topes. */
export function noteToDraft(note: ClinicalNoteJson | null | undefined): AssistantNoteDraft | undefined {
  if (!note || !Array.isArray(note.sections) || note.sections.length === 0) return undefined;
  const sections: AssistantNoteDraft["sections"] = [];
  let total = 0;
  for (const section of note.sections) {
    const key = `${section.key ?? ""}`.trim();
    if (!key) continue;
    const content = `${section.content ?? ""}`.trim().slice(0, MAX_DRAFT_SECTION_CHARS);
    if (total + content.length > MAX_DRAFT_TOTAL_CHARS) break;
    total += content.length;
    sections.push({ key, label: `${section.label ?? key}`.trim() || key, content });
  }
  if (!sections.length) return undefined;
  const summary = `${note.summary ?? ""}`.trim().slice(0, MAX_DRAFT_SUMMARY_CHARS);
  return summary ? { summary, sections } : { sections };
}

/** Códigos de la pestaña Codificación: aceptados y sugeridos, nunca descartados. */
export function codesToContext(codes: ClinicalCode[] | undefined): AssistantCodeContext[] {
  return (codes ?? [])
    .filter((code) => code.estado === "aceptado" || code.estado === "sugerido")
    .slice(0, MAX_CODES)
    .map((code) => ({
      sistema: code.sistema,
      codigo: `${code.codigo}`.trim(),
      descripcion: `${code.descripcion ?? ""}`.trim().slice(0, MAX_CODE_DESCRIPTION_CHARS),
      estado: code.estado as "aceptado" | "sugerido",
    }));
}

/** Edad y sexo del paciente registrado; nada más. */
export function patientToContext(patient: Patient | null | undefined): AssistantPatientContext | null {
  if (!patient) return null;
  const context: AssistantPatientContext = {};
  if (Number.isInteger(patient.edad) && patient.edad >= 0 && patient.edad <= 120) context.edad = patient.edad;
  if (patient.sexo === "F" || patient.sexo === "M") context.sexo = patient.sexo;
  return Object.keys(context).length ? context : null;
}

export function trimHistory(history: AssistantChatMessage[]): AssistantChatMessage[] {
  return history
    .filter((turn) => (turn.role === "user" || turn.role === "assistant") && `${turn.content ?? ""}`.trim())
    .slice(-MAX_HISTORY_TURNS)
    .map((turn) => ({ role: turn.role, content: `${turn.content}`.trim().slice(0, MAX_HISTORY_CHARS) }));
}

export interface BuildAssistantChatPayloadInput {
  message: string;
  history: AssistantChatMessage[];
  pathname?: string | null;
  /** Especialidad del perfil; la de la consulta (contexto) manda si existe. */
  specialtyCode?: string | null;
  doctor?: AssistantDoctorContext;
  context: AssistantPayloadContext | null;
  /**
   * false = reintento tras ENCOUNTER_NOT_FOUND: se conserva todo el contexto
   * en pantalla pero no se pide el encounter al servidor.
   */
  includeEncounter?: boolean;
}

export function buildAssistantChatPayload({
  message,
  history,
  pathname,
  specialtyCode,
  doctor,
  context,
  includeEncounter = true,
}: BuildAssistantChatPayloadInput): AssistantChatPayload {
  const specialty = context?.specialtyCode || specialtyCode || "";
  const payload: AssistantChatPayload = {
    message: `${message}`.trim().slice(0, MAX_MESSAGE_CHARS),
    history: trimHistory(history),
    screen_context: pathname ? { route: pathname } : undefined,
    specialty: specialty ? normalizeSpecialtyCode(specialty) : undefined,
    doctor,
  };
  if (!context) return payload;

  if (includeEncounter && context.encounterId) payload.encounter_id = context.encounterId;
  const draft = noteToDraft(context.note);
  if (draft) payload.note_json_draft = draft;
  if (context.codes.length) payload.codes = context.codes.slice(0, MAX_CODES);
  if (context.patient) payload.patient_context = context.patient;
  if (!context.editable) payload.note_editable = false;
  return payload;
}
