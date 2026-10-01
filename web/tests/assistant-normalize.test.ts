import { describe, expect, it } from "vitest";
import { normalizeAssistantResult, sourceLabel } from "@/lib/assistant/normalize";
import type { AssistantChatResult } from "@/lib/api/clinical";

const notaPropuesta = {
  summary: "s",
  sections: [{ key: "plan", label: "Plan", content: "Nuevo plan." }],
  warnings: [],
  missing_required_sections: [],
};

describe("normalizeAssistantResult", () => {
  it("una respuesta v1 (Graph viejo) cae a valores seguros", () => {
    const out = normalizeAssistantResult({ answer: "  Texto  ", mode: "clinical_chat" });
    expect(out).toEqual({
      answer: "Texto",
      support: undefined,
      sources: [],
      missing: [],
      alerts: [],
      followUps: [],
      proposal: null,
    });
  });

  it("respeta el enum de respaldo y acota las listas", () => {
    const raw: AssistantChatResult = {
      answer: "x",
      mode: "clinical_chat",
      support: "guia",
      sources: [{ ref: "G1", guideline_id: "hta", title: "HTA", organism: "ESC", year: 2024, section: "Metas" }],
      missing_information: ["a", "a", "b", "c", "d", "e", "f", "g"],
      alarm_signs: ["", "   ", "síncope"],
      follow_up_questions: ["1", "2", "3", "4"],
      note_proposal: null,
    };
    const out = normalizeAssistantResult(raw);
    expect(out.support).toBe("guia");
    expect(out.sources[0].guideline_id).toBe("hta");
    expect(out.missing).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(out.alerts).toEqual(["síncope"]);
    expect(out.followUps).toEqual(["1", "2", "3"]);
    expect(normalizeAssistantResult({ ...raw, support: "otro" as never }).support).toBeUndefined();
  });

  it("una propuesta sin secciones cambiadas ni resumen no es una propuesta", () => {
    const vacia = normalizeAssistantResult({
      answer: "x",
      mode: "clinical_chat",
      note_proposal: { proposed_note_json: notaPropuesta, changed_sections: [], explanation: "", requires_physician_review: true },
    });
    expect(vacia.proposal).toBeNull();

    const conCambio = normalizeAssistantResult({
      answer: "x",
      mode: "clinical_chat",
      note_proposal: {
        proposed_note_json: notaPropuesta,
        changed_sections: [{ key: "plan", label: "Plan", content: "Nuevo plan.", previous_content: "Viejo." }],
        explanation: "Cambió el plan.",
        requires_physician_review: true,
      },
    });
    expect(conCambio.proposal?.changed_sections).toEqual([
      { key: "plan", label: "Plan", content: "Nuevo plan.", previous_content: "Viejo." },
    ]);
    expect(conCambio.proposal?.summary).toBeNull();
  });

  it("sourceLabel: organismo y año, o el título si faltan", () => {
    expect(sourceLabel({ ref: "G1", guideline_id: "x", title: "T", organism: "GINA", year: 2024, section: "Escalón 3" })).toBe("GINA 2024 · Escalón 3");
    expect(sourceLabel({ ref: "G1", guideline_id: "x", title: "Título" })).toBe("Título");
  });
});
