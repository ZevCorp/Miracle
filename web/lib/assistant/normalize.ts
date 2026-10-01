// La respuesta del asistente tal como la pinta el chat.
//
// Graph puede ser más viejo que esta web (despliegues independientes): una
// respuesta v1 trae solo `answer`. Aquí todo lo nuevo cae a un valor seguro,
// y una propuesta sin secciones cambiadas no es una propuesta.

import type {
  AssistantChatResult,
  AssistantNoteProposal,
  AssistantSource,
  AssistantSupport,
} from "@/lib/api/clinical";

export interface AssistantTurnData {
  answer: string;
  /** undefined = Graph v1, sin señal de respaldo. */
  support?: AssistantSupport;
  sources: AssistantSource[];
  missing: string[];
  alerts: string[];
  followUps: string[];
  proposal: AssistantNoteProposal | null;
}

const SUPPORT_VALUES: AssistantSupport[] = ["consulta", "guia", "general", "insuficiente"];

function stringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const text = typeof item === "string" ? item.trim() : "";
    if (text && !out.includes(text)) out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

function normalizeSources(value: unknown): AssistantSource[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is AssistantSource => Boolean(item) && typeof item === "object" && typeof (item as AssistantSource).ref === "string")
    .map((item) => ({
      ref: item.ref,
      guideline_id: `${item.guideline_id ?? ""}`,
      title: `${item.title ?? ""}`.trim() || item.ref,
      organism: item.organism ? `${item.organism}` : undefined,
      year: item.year,
      section: item.section ? `${item.section}` : undefined,
      source: item.source ? `${item.source}` : undefined,
    }));
}

function normalizeProposal(value: unknown): AssistantNoteProposal | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<AssistantNoteProposal>;
  const changed = Array.isArray(raw.changed_sections)
    ? raw.changed_sections.filter(
        (section) =>
          Boolean(section) &&
          typeof section.key === "string" &&
          section.key.trim() &&
          typeof section.content === "string",
      )
    : [];
  const summary = typeof raw.summary === "string" && raw.summary.trim() ? raw.summary : null;
  if (!changed.length && !summary) return null;
  if (!raw.proposed_note_json || !Array.isArray(raw.proposed_note_json.sections)) return null;
  return {
    proposed_note_json: raw.proposed_note_json,
    changed_sections: changed.map((section) => ({
      key: section.key,
      label: `${section.label ?? section.key}`,
      content: section.content,
      previous_content: `${section.previous_content ?? ""}`,
    })),
    summary,
    explanation: `${raw.explanation ?? ""}`.trim(),
    requires_physician_review: raw.requires_physician_review !== false,
  };
}

export function normalizeAssistantResult(raw: AssistantChatResult): AssistantTurnData {
  const support = SUPPORT_VALUES.includes(raw.support as AssistantSupport)
    ? (raw.support as AssistantSupport)
    : undefined;
  return {
    answer: `${raw.answer ?? ""}`.trim(),
    support,
    sources: normalizeSources(raw.sources),
    missing: stringList(raw.missing_information, 6),
    alerts: stringList(raw.alarm_signs, 6),
    followUps: stringList(raw.follow_up_questions, 3),
    proposal: normalizeProposal(raw.note_proposal),
  };
}

/** Etiqueta corta de una fuente: «GINA 2024 · Escalón 3». */
export function sourceLabel(source: AssistantSource): string {
  const head = [source.organism, source.year].filter(Boolean).join(" ");
  const title = head || source.title;
  return source.section ? `${title} · ${source.section}` : title;
}
