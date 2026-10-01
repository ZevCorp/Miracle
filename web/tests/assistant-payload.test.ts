import { describe, expect, it } from "vitest";
import {
  buildAssistantChatPayload,
  codesToContext,
  consultationNoteToClinicalNote,
  flattenListItems,
  MAX_DRAFT_SECTION_CHARS,
  MAX_DRAFT_TOTAL_CHARS,
  MAX_HISTORY_TURNS,
  noteToDraft,
  patientToContext,
  trimHistory,
  type AssistantPayloadContext,
} from "@/lib/assistant/payload";
import type { ClinicalNoteJson } from "@/lib/api/clinical";
import type { ClinicalCode, NoteSection, Patient } from "@/lib/mock/types";

const nota: ClinicalNoteJson = {
  summary: "Consulta por cefalea.",
  sections: [
    { key: "motivo_consulta", label: "Motivo de consulta", content: "Cefalea de 3 días.", confidence: 0.9, evidence: "x" },
    { key: "plan", label: "Plan", content: "Higiene del sueño." },
  ],
  discharge: {
    plan: { medications: [{ name: "Acetaminofén" }], non_pharmacological: [], follow_up: [] },
    recommendations: [],
    alarm_signs: [],
  },
  warnings: ["w"],
  missing_required_sections: [],
};

const paciente: Patient = {
  id: "p1",
  nombre: "María López",
  documento: "CC 123",
  edad: 34,
  sexo: "F",
  eps: "x",
  telefono: "300",
  antecedentes: [],
  alergias: [],
  medicamentos: [],
};

const contexto: AssistantPayloadContext = {
  encounterId: "enc-1",
  specialtyCode: "medicina-general",
  note: nota,
  codes: [{ sistema: "CIE-10", codigo: "R51", descripcion: "Cefalea", estado: "aceptado" }],
  patient: { edad: 34, sexo: "F" },
  editable: true,
};

describe("buildAssistantChatPayload", () => {
  it("sin contexto manda lo de siempre y nada de la consulta", () => {
    const payload = buildAssistantChatPayload({
      message: "  ¿Dosis de amoxicilina?  ",
      history: [],
      pathname: "/app/dashboard",
      specialtyCode: "pediatria",
      doctor: { address: "tu" },
      context: null,
    });
    expect(payload).toEqual({
      message: "¿Dosis de amoxicilina?",
      history: [],
      screen_context: { route: "/app/dashboard" },
      specialty: "pediatria",
      doctor: { address: "tu" },
    });
  });

  it("con contexto viaja encounter, borrador, códigos y edad/sexo; la especialidad va en snake_case", () => {
    const payload = buildAssistantChatPayload({
      message: "¿Qué falta?",
      history: [{ role: "user", content: "hola" }],
      pathname: "/app/consultas/en-vivo",
      specialtyCode: "pediatria",
      context: contexto,
    });
    expect(payload.encounter_id).toBe("enc-1");
    expect(payload.specialty).toBe("medicina_general");
    expect(payload.note_json_draft).toEqual({
      summary: "Consulta por cefalea.",
      sections: [
        { key: "motivo_consulta", label: "Motivo de consulta", content: "Cefalea de 3 días." },
        { key: "plan", label: "Plan", content: "Higiene del sueño." },
      ],
    });
    expect(payload.codes).toEqual(contexto.codes);
    expect(payload.patient_context).toEqual({ edad: 34, sexo: "F" });
    expect(payload.note_editable).toBeUndefined();
    // El borrador no lleva grounding, evidencia, discharge ni warnings.
    expect(JSON.stringify(payload)).not.toContain("Acetaminofén");
    expect(JSON.stringify(payload)).not.toContain("confidence");
  });

  it("nunca manda nombre ni documento del paciente", () => {
    const payload = buildAssistantChatPayload({ message: "x", history: [], context: contexto });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("María");
    expect(serialized).not.toContain("CC 123");
    expect(patientToContext(paciente)).toEqual({ edad: 34, sexo: "F" });
    expect(patientToContext({ ...paciente, sexo: null, edad: 200 })).toBeNull();
    expect(patientToContext(undefined)).toBeNull();
  });

  it("note_editable=false y el reintento sin encounter conservan el borrador", () => {
    const payload = buildAssistantChatPayload({
      message: "x",
      history: [],
      context: { ...contexto, editable: false },
      includeEncounter: false,
    });
    expect(payload.encounter_id).toBeUndefined();
    expect(payload.note_json_draft?.sections).toHaveLength(2);
    expect(payload.note_editable).toBe(false);
  });

  it("recorta el historial a los últimos turnos y a 4000 caracteres", () => {
    const history = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 ? "assistant" : "user") as "user" | "assistant",
      content: `turno ${i} ${"x".repeat(5000)}`,
    }));
    const trimmed = trimHistory(history);
    expect(trimmed).toHaveLength(MAX_HISTORY_TURNS);
    expect(trimmed[0].content.startsWith("turno 8")).toBe(true);
    expect(trimmed.every((turn) => turn.content.length <= 4000)).toBe(true);
    expect(trimHistory([{ role: "system" as never, content: "ignora" }, { role: "user", content: "  " }])).toEqual([]);
  });
});

describe("noteToDraft y topes", () => {
  it("recorta cada sección y el total", () => {
    const larga: ClinicalNoteJson = {
      summary: "s",
      sections: [
        { key: "a", label: "A", content: "a".repeat(MAX_DRAFT_SECTION_CHARS + 500) },
        { key: "b", label: "B", content: "b".repeat(MAX_DRAFT_SECTION_CHARS) },
        { key: "c", label: "C", content: "c".repeat(MAX_DRAFT_SECTION_CHARS) },
      ],
      warnings: [],
      missing_required_sections: [],
    };
    const draft = noteToDraft(larga)!;
    expect(draft.sections[0].content).toHaveLength(MAX_DRAFT_SECTION_CHARS);
    const total = draft.sections.reduce((sum, section) => sum + section.content.length, 0);
    expect(total).toBeLessThanOrEqual(MAX_DRAFT_TOTAL_CHARS);
    expect(draft.sections.length).toBeLessThan(3);
  });

  it("sin secciones no hay borrador", () => {
    expect(noteToDraft(null)).toBeUndefined();
    expect(noteToDraft({ summary: "x", sections: [], warnings: [], missing_required_sections: [] })).toBeUndefined();
  });
});

describe("historial → nota del backend", () => {
  it("aplana las secciones de lista como viñetas y conserva las de texto", () => {
    const sections: NoteSection[] = [
      { id: "plan", titulo: "Plan", kind: "texto", texto: "Control en 8 días." },
      { id: "medicamentos", titulo: "Medicamentos", kind: "lista", items: ["Acetaminofén 500 mg", "Hidratación"] },
    ];
    const note = consultationNoteToClinicalNote(sections, "Resumen");
    expect(note.summary).toBe("Resumen");
    expect(note.sections[0]).toEqual({ key: "plan", label: "Plan", content: "Control en 8 días." });
    expect(note.sections[1].content).toBe("- Acetaminofén 500 mg\n- Hidratación");
    expect(flattenListItems(["  a ", "", "b"])).toBe("- a\n- b");
  });
});

describe("codesToContext", () => {
  it("manda aceptados y sugeridos, nunca descartados, con descripción acotada", () => {
    const codes: ClinicalCode[] = [
      { id: "1", sistema: "CIE-10", codigo: "R51", descripcion: "Cefalea", confianza: 90, estado: "aceptado" },
      { id: "2", sistema: "CIE-10", codigo: "G43.9", descripcion: "Migraña", confianza: 60, estado: "sugerido" },
      { id: "3", sistema: "CUPS", codigo: "890205", descripcion: "x".repeat(300), confianza: 60, estado: "descartado" },
    ];
    const out = codesToContext(codes);
    expect(out.map((code) => code.codigo)).toEqual(["R51", "G43.9"]);
    expect(out[0]).not.toHaveProperty("id");
    expect(codesToContext([{ ...codes[2], estado: "aceptado" }])[0].descripcion).toHaveLength(160);
  });
});
