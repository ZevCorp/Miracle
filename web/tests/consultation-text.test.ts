import { describe, expect, it } from "vitest";
import {
  buildConsultationPlainText,
  type ConsultationTextInput,
} from "@/lib/clinical/consultation-text";
import type { ClinicalCode, NoteSection } from "@/lib/mock";

function seccionTexto(id: string, titulo: string, contenido: string): NoteSection {
  return { id, titulo, kind: "texto", texto: contenido };
}

function seccionLista(id: string, titulo: string, items: string[]): NoteSection {
  return { id, titulo, kind: "lista", items };
}

function code(partial: Partial<ClinicalCode>): ClinicalCode {
  return {
    id: partial.id ?? `c-${Math.random().toString(16).slice(2)}`,
    sistema: partial.sistema ?? "CIE-10",
    codigo: partial.codigo ?? "I10",
    descripcion: partial.descripcion ?? "Hipertensión esencial",
    confianza: partial.confianza ?? 90,
    estado: partial.estado ?? "aceptado",
  };
}

function base(over: Partial<ConsultationTextInput> = {}): ConsultationTextInput {
  return {
    especialidad: "Patología",
    servicio: "Consulta externa",
    fecha: "2026-07-20T15:30:00.000Z",
    note: [seccionTexto("motivo", "Motivo de consulta", "Biopsia de piel para estudio histopatológico.")],
    codigos: [],
    ...over,
  };
}

describe("buildConsultationPlainText", () => {
  it("incluye los datos del paciente cuando están presentes", () => {
    const output = buildConsultationPlainText(
      base({
        patient: { nombre: "Ana Ruiz", edad: 45, sexo: "F", documento: "CC 1.020.304" },
        medicoNombre: "Dra. Juliana Pérez",
      }),
    );
    expect(output).toContain("Ana Ruiz");
    expect(output).toContain("45 años · Femenino");
    expect(output).toContain("Doc: CC 1.020.304");
    expect(output).toContain("Dra. Juliana Pérez");
    expect(output).toContain("Patología · Consulta externa");
  });

  it("usa 'Paciente sin identificar' y omite edad/documento cuando no hay paciente", () => {
    const output = buildConsultationPlainText(base({ patient: null }));
    expect(output).toContain("Paciente sin identificar");
    expect(output).not.toContain("Doc:");
    expect(output).not.toContain("años");
  });

  it("serializa secciones de texto", () => {
    const output = buildConsultationPlainText(
      base({ note: [seccionTexto("plan", "Plan", "Continuar seguimiento en 3 meses.")] }),
    );
    expect(output).toContain("Plan");
    expect(output).toContain("Continuar seguimiento en 3 meses.");
  });

  it("serializa secciones de lista como viñetas", () => {
    const output = buildConsultationPlainText(
      base({ note: [seccionLista("hallazgos", "Hallazgos", ["Lesión eritematosa", "Bordes definidos"])] }),
    );
    expect(output).toContain("Hallazgos");
    expect(output).toContain("- Lesión eritematosa");
    expect(output).toContain("- Bordes definidos");
  });

  it("marca una sección de lista vacía sin viñetas sueltas", () => {
    const output = buildConsultationPlainText(base({ note: [seccionLista("vacio", "Antecedentes", [])] }));
    expect(output).toContain("Antecedentes");
    expect(output).not.toContain("- ");
  });

  it("solo lista códigos aceptados, no sugeridos ni descartados", () => {
    const output = buildConsultationPlainText(
      base({
        codigos: [
          code({ codigo: "L57.0", descripcion: "Queratosis actínica", estado: "aceptado" }),
          code({ codigo: "C44.9", descripcion: "Carcinoma de piel", estado: "sugerido" }),
          code({ codigo: "D22.5", descripcion: "Nevus melanocítico", estado: "descartado" }),
        ],
      }),
    );
    expect(output).toContain("CIE-10 L57.0 — Queratosis actínica");
    expect(output).not.toContain("C44.9");
    expect(output).not.toContain("D22.5");
  });

  it("indica cuando no hay códigos aceptados", () => {
    const output = buildConsultationPlainText(base({ codigos: [] }));
    expect(output).toContain("Sin códigos aceptados.");
  });

  it("omite la sección de adendas cuando no hay ninguna", () => {
    const output = buildConsultationPlainText(base({ addenda: [] }));
    expect(output).not.toContain("Adendas");
  });

  it("incluye adendas con autor, fecha y contenido", () => {
    const output = buildConsultationPlainText(
      base({
        addenda: [
          {
            autor: "Dr. Felipe Maldonado",
            fecha: "2026-07-21T10:00:00.000Z",
            contenido: "Se amplía descripción macroscópica.",
          },
        ],
      }),
    );
    expect(output).toContain("Adendas");
    expect(output).toContain("Dr. Felipe Maldonado");
    expect(output).toContain("Se amplía descripción macroscópica.");
    expect(output).toContain("Adenda a nota firmada — no modifica el documento original.");
  });
});
