import { describe, expect, it } from "vitest";
import {
  buildConsultationHtml,
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

  it("incluye la identificación y el registro médico del profesional cuando están presentes", () => {
    const output = buildConsultationPlainText(
      base({
        medicoNombre: "Álvaro Restrepo Pareja",
        medicoIdentificacion: "71595247",
        medicoRegistro: "71595247",
      }),
    );
    expect(output).toContain("Álvaro Restrepo Pareja · CC 71595247 · Reg. Med. 71595247");
  });

  it("omite la identificación del médico cuando no está registrada", () => {
    const output = buildConsultationPlainText(
      base({ medicoNombre: "Dra. Juliana Pérez", medicoIdentificacion: null, medicoRegistro: null }),
    );
    expect(output).not.toContain("CC ");
    expect(output).not.toContain("Reg. Med.");
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
    expect(output).toContain("PLAN");
    expect(output).toContain("Continuar seguimiento en 3 meses.");
  });

  it("serializa secciones de lista como viñetas", () => {
    const output = buildConsultationPlainText(
      base({ note: [seccionLista("hallazgos", "Hallazgos", ["Lesión eritematosa", "Bordes definidos"])] }),
    );
    expect(output).toContain("HALLAZGOS");
    expect(output).toContain("- Lesión eritematosa");
    expect(output).toContain("- Bordes definidos");
  });

  it("marca una sección de lista vacía sin viñetas sueltas", () => {
    const output = buildConsultationPlainText(base({ note: [seccionLista("vacio", "Antecedentes", [])] }));
    expect(output).toContain("ANTECEDENTES");
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
    expect(output).not.toContain("ADENDAS");
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
    expect(output).toContain("ADENDAS");
    expect(output).toContain("Dr. Felipe Maldonado");
    expect(output).toContain("Se amplía descripción macroscópica.");
    expect(output).toContain("Adenda a nota firmada — no modifica el documento original.");
  });
});

describe("buildConsultationHtml", () => {
  it("pone los títulos de sección en negrilla y mayúscula", () => {
    const html = buildConsultationHtml(
      base({ note: [seccionTexto("plan", "Plan", "Continuar seguimiento en 3 meses.")] }),
    );
    expect(html).toContain("<strong>PLAN</strong>");
    expect(html).toContain("<strong>CODIFICACIÓN</strong>");
    // El contenido NO va en negrilla: solo los títulos.
    expect(html).toContain("<p>Continuar seguimiento en 3 meses.</p>");
  });

  it("las listas salen como viñetas reales", () => {
    const html = buildConsultationHtml(
      base({ note: [seccionLista("hallazgos", "Hallazgos", ["Lesión eritematosa"])] }),
    );
    expect(html).toContain("<strong>HALLAZGOS</strong>");
    expect(html).toContain("<li>Lesión eritematosa</li>");
  });

  it("escapa el HTML del contenido clínico", () => {
    const html = buildConsultationHtml(
      base({ note: [seccionTexto("dx", "Diagnóstico", "Lesión <5 mm & bordes netos")] }),
    );
    expect(html).toContain("Lesión &lt;5 mm &amp; bordes netos");
    expect(html).not.toContain("<5 mm");
  });

  it("respeta los saltos de línea dentro de una sección", () => {
    const html = buildConsultationHtml(
      base({ note: [seccionTexto("macro", "Macroscópica", "1. Primer fragmento.\n2. Segundo.")] }),
    );
    expect(html).toContain("1. Primer fragmento.<br>2. Segundo.");
  });

  it("lleva el mismo contenido clínico que la versión en texto plano", () => {
    const datos = base({
      patient: { nombre: "Ana Ruiz", edad: 45, sexo: "F", documento: "CC 1.020.304" },
      medicoNombre: "Dra. Juliana Pérez",
      note: [seccionTexto("dx", "Diagnóstico", "Queratosis actínica.")],
    });
    const plano = buildConsultationPlainText(datos);
    const html = buildConsultationHtml(datos);
    for (const fragmento of ["Ana Ruiz", "Dra. Juliana Pérez", "Queratosis actínica."]) {
      expect(plano).toContain(fragmento);
      expect(html).toContain(fragmento);
    }
    expect(plano).toContain("DIAGNÓSTICO");
    expect(html).toContain("<strong>DIAGNÓSTICO</strong>");
  });
});
