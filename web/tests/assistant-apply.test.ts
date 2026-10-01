import { describe, expect, it } from "vitest";
import {
  applyProposalToNote,
  detectProposalDrift,
  detectSectionDrift,
  proposalToSectionChanges,
  unflattenListItems,
} from "@/lib/assistant/apply";
import type { AssistantNoteProposal, ClinicalNoteJson } from "@/lib/api/clinical";
import type { NoteSection } from "@/lib/mock/types";

const nota: ClinicalNoteJson = {
  summary: "Resumen original.",
  sections: [
    { key: "motivo", label: "Motivo", content: "Cefalea.", grounding: "explicit", evidence: "cefalea" },
    { key: "plan", label: "Plan", content: "Plan viejo.", grounding: "entailed" },
  ],
  discharge: {
    plan: { medications: [{ name: "Acetaminofén", dose: "500 mg" }], non_pharmacological: [], follow_up: [] },
    recommendations: [],
    alarm_signs: [],
  },
  warnings: ["aviso"],
  missing_required_sections: [],
};

const propuesta: AssistantNoteProposal = {
  // Graph devuelve la nota validada SIN discharge: por eso nunca se usa entera.
  proposed_note_json: {
    summary: "Resumen original.",
    sections: [
      { key: "motivo", label: "Motivo", content: "Cefalea." },
      { key: "plan", label: "Plan", content: "Plan nuevo con control en 8 días." },
    ],
    warnings: [],
    missing_required_sections: [],
  },
  changed_sections: [
    { key: "plan", label: "Plan", content: "Plan nuevo con control en 8 días.", previous_content: "Plan viejo." },
    { key: "inexistente", label: "X", content: "no aplica", previous_content: "" },
  ],
  summary: null,
  explanation: "Se añadió el control.",
  requires_physician_review: true,
};

describe("applyProposalToNote", () => {
  it("fusiona por clave y conserva discharge, warnings, grounding y lo no tocado", () => {
    const next = applyProposalToNote(nota, propuesta);
    expect(next.sections.find((s) => s.key === "plan")?.content).toBe("Plan nuevo con control en 8 días.");
    expect(next.sections.find((s) => s.key === "plan")?.grounding).toBe("entailed");
    expect(next.sections.find((s) => s.key === "motivo")).toEqual(nota.sections[0]);
    expect(next.discharge).toEqual(nota.discharge);
    expect(next.warnings).toEqual(["aviso"]);
    expect(next.summary).toBe("Resumen original.");
    expect(next.sections).toHaveLength(2);
    expect(nota.sections[1].content).toBe("Plan viejo.");
  });

  it("aplica el resumen solo cuando la propuesta lo trae", () => {
    const next = applyProposalToNote(nota, { ...propuesta, summary: "Resumen nuevo." });
    expect(next.summary).toBe("Resumen nuevo.");
  });
});

describe("deriva entre la propuesta y el clic", () => {
  it("detecta la sección editada después de pedir la propuesta", () => {
    expect(detectProposalDrift(nota, propuesta)).toEqual([]);
    const editada = { ...nota, sections: nota.sections.map((s) => (s.key === "plan" ? { ...s, content: "Plan editado a mano." } : s)) };
    expect(detectProposalDrift(editada, propuesta).map((s) => s.key)).toEqual(["plan"]);
  });
});

describe("historial (NoteSection[])", () => {
  const secciones: NoteSection[] = [
    { id: "plan", titulo: "Plan", kind: "texto", texto: "Plan viejo." },
    { id: "medicamentos", titulo: "Medicamentos", kind: "lista", items: ["Acetaminofén"] },
  ];

  it("convierte la propuesta en cambios por sección respetando texto y lista", () => {
    const cambios = proposalToSectionChanges(secciones, {
      ...propuesta,
      changed_sections: [
        { key: "plan", label: "Plan", content: "Plan nuevo.", previous_content: "Plan viejo." },
        { key: "medicamentos", label: "Medicamentos", content: "- Acetaminofén\n- Ibuprofeno", previous_content: "- Acetaminofén" },
      ],
    });
    expect(cambios).toEqual([
      { id: "plan", next: { texto: "Plan nuevo." } },
      { id: "medicamentos", next: { items: ["Acetaminofén", "Ibuprofeno"] } },
    ]);
    expect(unflattenListItems("- a\n• b\n* c\nd\n\n")).toEqual(["a", "b", "c", "d"]);
  });

  it("detecta deriva comparando con la forma aplanada", () => {
    const sinDeriva = detectSectionDrift(secciones, {
      ...propuesta,
      changed_sections: [{ key: "medicamentos", label: "M", content: "x", previous_content: "- Acetaminofén" }],
    });
    expect(sinDeriva).toEqual([]);
    const conDeriva = detectSectionDrift(secciones, {
      ...propuesta,
      changed_sections: [{ key: "plan", label: "Plan", content: "x", previous_content: "otro" }],
    });
    expect(conDeriva.map((s) => s.key)).toEqual(["plan"]);
  });
});
