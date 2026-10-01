// Cómo se aplica una propuesta del asistente a la nota. Puro y compartido por
// la consulta en vivo (ClinicalNoteJson) y el detalle (NoteSection[] del
// historial).
//
// REGLA DURA: nunca se reemplaza la nota entera por `proposed_note_json`.
// Graph la devuelve validada, pero sin `discharge` y calculada sobre lo que
// la página mandó al preguntar; reemplazarla pisaría el plan de egreso y
// cualquier edición hecha después. Se fusionan por clave SOLO las secciones
// cambiadas (y el resumen si vino).

import { updateNoteSectionContent, type AssistantNoteProposal, type ClinicalNoteJson } from "@/lib/api/clinical";
import type { NoteSection } from "@/lib/mock/types";

/** Secciones que el médico editó entre la propuesta y el clic de «Aplicar». */
export function detectProposalDrift(
  note: ClinicalNoteJson,
  proposal: AssistantNoteProposal,
): AssistantNoteProposal["changed_sections"] {
  return proposal.changed_sections.filter((change) => {
    const current = note.sections.find((section) => section.key === change.key);
    if (!current) return false;
    return `${current.content ?? ""}` !== change.previous_content;
  });
}

/** Fusión por clave sobre la nota actual; conserva discharge, warnings y lo no tocado. */
export function applyProposalToNote(note: ClinicalNoteJson, proposal: AssistantNoteProposal): ClinicalNoteJson {
  let next = note;
  for (const change of proposal.changed_sections) {
    if (!note.sections.some((section) => section.key === change.key)) continue;
    next = updateNoteSectionContent(next, change.key, change.content);
  }
  if (typeof proposal.summary === "string" && proposal.summary.trim()) {
    next = { ...next, summary: proposal.summary };
  }
  return next;
}

/** `- ítem` por línea → ítems; líneas sin viñeta también cuentan. */
export function unflattenListItems(content: string): string[] {
  return `${content ?? ""}`
    .split("\n")
    .map((line) => line.replace(/^\s*[-•*]\s+/, "").trim())
    .filter(Boolean);
}

/** Cambios para el historial: cada sección cambiada con su forma (texto o lista). */
export function proposalToSectionChanges(
  sections: NoteSection[],
  proposal: AssistantNoteProposal,
): { id: string; next: Partial<NoteSection> }[] {
  const changes: { id: string; next: Partial<NoteSection> }[] = [];
  for (const change of proposal.changed_sections) {
    const section = sections.find((item) => item.id === change.key);
    if (!section) continue;
    changes.push({
      id: section.id,
      next: section.kind === "lista" ? { items: unflattenListItems(change.content) } : { texto: change.content },
    });
  }
  return changes;
}

/** Deriva para la forma del historial. */
export function detectSectionDrift(
  sections: NoteSection[],
  proposal: AssistantNoteProposal,
): AssistantNoteProposal["changed_sections"] {
  return proposal.changed_sections.filter((change) => {
    const section = sections.find((item) => item.id === change.key);
    if (!section) return false;
    const current = section.kind === "lista"
      ? (section.items ?? []).map((item) => `- ${item}`).join("\n")
      : `${section.texto ?? ""}`;
    return current !== change.previous_content;
  });
}
