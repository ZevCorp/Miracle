import { describe, expect, it } from "vitest";
import {
  deriveMotivo,
  encounterToConsultation,
  noteJsonToSections,
  specialtyDisplayName,
  toStoreConsultationType,
  transcriptTextToTurns,
} from "@/lib/clinical/encounter-to-consultation";
import type { ClinicalNoteJson } from "@/lib/api/clinical";
import type { Patient } from "@/lib/mock";

const note: ClinicalNoteJson = {
  summary: "Consulta por cefalea de tres días sin signos de alarma.",
  sections: [
    { key: "motivo_consulta", label: "Motivo de consulta", content: "Cefalea de 3 días.", confidence: 0.9 },
    { key: "plan", label: "Plan y recomendaciones", content: "Reposo e hidratación.", confidence: 0.8 },
  ],
  warnings: [],
  missing_required_sections: [],
};

describe("specialtyDisplayName", () => {
  it("resuelve el nombre desde el code snake_case del backend", () => {
    expect(specialtyDisplayName("medicina_general")).toBe("Medicina general");
    expect(specialtyDisplayName("ginecologia_obstetricia")).toBe("Ginecología y obstetricia");
  });
  it("degrada legible si el code no está en el catálogo", () => {
    expect(specialtyDisplayName("algo_raro")).toBe("algo raro");
    expect(specialtyDisplayName(undefined)).toBe("");
  });
});

describe("toStoreConsultationType", () => {
  it("mapea el tipo del backend al del store", () => {
    expect(toStoreConsultationType("presencial")).toBe("presencial");
    expect(toStoreConsultationType("telemedicina")).toBe("telemedicina");
    expect(toStoreConsultationType("audio_upload")).toBe("audio");
    expect(toStoreConsultationType(undefined)).toBe("presencial");
  });
});

describe("noteJsonToSections", () => {
  it("convierte cada sección del backend a NoteSection de texto preservando key y label", () => {
    const sections = noteJsonToSections(note);
    expect(sections).toEqual([
      { id: "motivo_consulta", titulo: "Motivo de consulta", kind: "texto", texto: "Cefalea de 3 días." },
      { id: "plan", titulo: "Plan y recomendaciones", kind: "texto", texto: "Reposo e hidratación." },
    ]);
  });
});

describe("deriveMotivo", () => {
  it("toma el motivo de la sección 'motivo…' si existe", () => {
    expect(deriveMotivo(note)).toBe("Cefalea de 3 días.");
  });
  it("cae al resumen si no hay sección de motivo", () => {
    const sinMotivo: ClinicalNoteJson = { ...note, sections: [note.sections[1]] };
    expect(deriveMotivo(sinMotivo)).toBe(note.summary);
  });
  it("trunca motivos muy largos", () => {
    const largo = "x".repeat(200);
    const n: ClinicalNoteJson = { ...note, summary: largo, sections: [] };
    const motivo = deriveMotivo(n);
    expect(motivo.length).toBeLessThanOrEqual(140);
    expect(motivo.endsWith("…")).toBe(true);
  });
});

describe("encounterToConsultation (el puente)", () => {
  const patient = { id: "patient-uuid", nombre: "Ana Pérez" } as Patient;
  const base = {
    encounter: {
      id: "enc-uuid-123",
      consultation_type: "presencial" as const,
      created_at: "2026-07-10T10:00:00.000Z",
      template_snapshot: {
        template_id: "t1",
        name: "Consulta inicial · Medicina general",
        specialty: "medicina_general",
        sections: [],
      },
    },
    note,
    patient,
    now: "2026-07-14T12:00:00.000Z",
  };

  it("usa el mismo id del encounter (puente 1:1, idempotente)", () => {
    expect(encounterToConsultation(base).id).toBe("enc-uuid-123");
  });

  it("mapea a una consulta en estado borrador lista para firmar", () => {
    const c = encounterToConsultation(base);
    expect(c.estado).toBe("borrador");
    expect(c.pacienteId).toBe("patient-uuid");
    expect(c.especialidad).toBe("Medicina general");
    expect(c.plantilla).toBe("Consulta inicial · Medicina general");
    expect(c.tipo).toBe("presencial");
    expect(c.resumen).toBe(note.summary);
    expect(c.motivo).toBe("Cefalea de 3 días.");
    expect(c.note).toHaveLength(2);
    expect(c.fecha).toBe("2026-07-10T10:00:00.000Z"); // usa created_at del encounter
  });

  it("sin paciente deja pacienteId vacío (no inventa identidad)", () => {
    const c = encounterToConsultation({ ...base, patient: undefined });
    expect(c.pacienteId).toBe("");
  });

  it("sin created_at usa el `now` recibido", () => {
    const enc = { ...base.encounter, created_at: undefined };
    const c = encounterToConsultation({ ...base, encounter: enc });
    expect(c.fecha).toBe("2026-07-14T12:00:00.000Z");
  });

  it("no fabrica códigos CIE-10/CUPS; sin transcripción deja el espejo vacío", () => {
    const c = encounterToConsultation(base);
    expect(c.codigos).toEqual([]);
    expect(c.transcript).toEqual([]);
  });

  it("espeja la transcripción verbatim tal cual (un turno sin hablante)", () => {
    const c = encounterToConsultation({ ...base, transcript: "  Paciente refiere cefalea.  " });
    expect(c.transcript).toEqual([{ t: "", texto: "Paciente refiere cefalea." }]);
  });
});

describe("transcriptTextToTurns", () => {
  it("convierte texto verbatim a un único turno sin hablante", () => {
    expect(transcriptTextToTurns("Hola, ¿cómo sigue?")).toEqual([
      { t: "", texto: "Hola, ¿cómo sigue?" },
    ]);
  });
  it("vacío o solo espacios → [] (no fabrica transcripción)", () => {
    expect(transcriptTextToTurns("   ")).toEqual([]);
    expect(transcriptTextToTurns(undefined)).toEqual([]);
  });
});
