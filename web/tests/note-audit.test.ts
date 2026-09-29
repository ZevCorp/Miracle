import { describe, expect, it } from "vitest";
import {
  auditConsultation,
  auditSeverityRank,
  auditSummaryLabel,
  sectionContent,
  worstSeverity,
  type AuditableConsultation,
} from "@/lib/clinical/note-audit";
import type { ClinicalCode, Consultation, NoteSection } from "@/lib/mock";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function texto(id: string, titulo: string, contenido: string): NoteSection {
  return { id, titulo, kind: "texto", texto: contenido };
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

/** Consulta "buena": motivo, secciones llenas, dx + cups aceptados, resumen. */
function consultaCompleta(over: Partial<AuditableConsultation> = {}): AuditableConsultation {
  return {
    estado: "borrador",
    motivo: "Control de hipertensión",
    resumen: "Paciente estable, continúa manejo antihipertensivo.",
    note: [
      texto("motivo", "Motivo de consulta", "Acude a control de tensión arterial."),
      texto("plan", "Plan", "Continuar losartán 50 mg cada día y control en un mes."),
    ],
    codigos: [
      code({ sistema: "CIE-10", codigo: "I10", estado: "aceptado" }),
      code({ sistema: "CUPS", codigo: "890201", estado: "aceptado" }),
    ],
    firma: null,
    ...over,
  };
}

/* ------------------------------------------------------------------ */
/* sectionContent                                                      */
/* ------------------------------------------------------------------ */

describe("sectionContent", () => {
  it("toma el texto recortado de una sección de texto", () => {
    expect(sectionContent(texto("a", "A", "  hola  "))).toBe("hola");
  });

  it("une los ítems no vacíos de una lista", () => {
    const s: NoteSection = { id: "l", titulo: "L", kind: "lista", items: ["uno", "  ", "dos"] };
    expect(sectionContent(s)).toBe("uno\ndos");
  });

  it("una sección vacía devuelve cadena vacía", () => {
    expect(sectionContent(texto("a", "A", "   "))).toBe("");
    expect(sectionContent({ id: "l", titulo: "L", kind: "lista", items: [] })).toBe("");
  });
});

/* ------------------------------------------------------------------ */
/* Nota completa → sin observaciones                                   */
/* ------------------------------------------------------------------ */

describe("auditConsultation — nota completa", () => {
  it("no produce hallazgos y da puntaje 100", () => {
    const report = auditConsultation(consultaCompleta());
    expect(report.hallazgos).toHaveLength(0);
    expect(report.puntaje).toBe(100);
    expect(worstSeverity(report)).toBeNull();
    expect(auditSummaryLabel(report)).toBe("Sin observaciones");
  });
});

/* ------------------------------------------------------------------ */
/* Hallazgos individuales                                              */
/* ------------------------------------------------------------------ */

describe("auditConsultation — hallazgos", () => {
  it("marca motivo ausente como advertencia", () => {
    const report = auditConsultation(consultaCompleta({ motivo: "   " }));
    const h = report.hallazgos.find((x) => x.key === "motivo-ausente");
    expect(h?.severidad).toBe("advertencia");
  });

  it("secciones vacías en edición → advertencia; firmada → crítico", () => {
    const conVacia = consultaCompleta({
      note: [
        texto("motivo", "Motivo de consulta", "Dolor abdominal."),
        texto("plan", "Plan", "   "),
      ],
    });
    const enEdicion = auditConsultation(conVacia);
    const h1 = enEdicion.hallazgos.find((x) => x.key === "secciones-vacias");
    expect(h1?.severidad).toBe("advertencia");
    expect(h1?.detalle).toContain("Plan");

    const firmada = auditConsultation({ ...conVacia, firma: { por: "Dra. X" } });
    const h2 = firmada.hallazgos.find((x) => x.key === "secciones-vacias");
    expect(h2?.severidad).toBe("critico");
    expect(h2?.titulo).toContain("firmada");
  });

  it("sin diagnóstico CIE-10 → advertencia; nota cerrada → crítico", () => {
    const sinDx = consultaCompleta({
      codigos: [code({ sistema: "CUPS", estado: "aceptado" })],
    });
    expect(
      auditConsultation(sinDx).hallazgos.find((x) => x.key === "sin-diagnostico")
        ?.severidad,
    ).toBe("advertencia");
    expect(
      auditConsultation({ ...sinDx, estado: "exportada" }).hallazgos.find(
        (x) => x.key === "sin-diagnostico",
      )?.severidad,
    ).toBe("critico");
  });

  it("cuenta códigos sugeridos sin resolver", () => {
    const report = auditConsultation(
      consultaCompleta({
        codigos: [
          code({ sistema: "CIE-10", estado: "aceptado" }),
          code({ sistema: "CUPS", estado: "aceptado" }),
          code({ codigo: "E11", estado: "sugerido" }),
          code({ codigo: "E78", estado: "sugerido" }),
        ],
      }),
    );
    const h = report.hallazgos.find((x) => x.key === "codigos-sin-resolver");
    expect(h?.titulo).toContain("2 códigos");
  });

  it("sin CUPS y sin resumen son sugerencias", () => {
    const report = auditConsultation(
      consultaCompleta({
        codigos: [code({ sistema: "CIE-10", estado: "aceptado" })],
        resumen: "",
      }),
    );
    expect(report.hallazgos.find((x) => x.key === "sin-procedimiento")?.severidad).toBe(
      "sugerencia",
    );
    expect(report.hallazgos.find((x) => x.key === "sin-resumen")?.severidad).toBe(
      "sugerencia",
    );
  });

  it("nota muy breve se marca como sugerencia sin duplicar con secciones vacías", () => {
    const report = auditConsultation(
      consultaCompleta({
        note: [texto("motivo", "Motivo de consulta", "ok"), texto("plan", "Plan", "sí")],
      }),
    );
    expect(report.hallazgos.find((x) => x.key === "nota-breve")?.severidad).toBe(
      "sugerencia",
    );
  });

  it("no marca 'nota breve' cuando todas las secciones están vacías (evita ruido doble)", () => {
    const report = auditConsultation(
      consultaCompleta({
        note: [texto("motivo", "Motivo de consulta", "  "), texto("plan", "Plan", "")],
      }),
    );
    expect(report.hallazgos.some((x) => x.key === "nota-breve")).toBe(false);
    expect(report.hallazgos.some((x) => x.key === "secciones-vacias")).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Puntaje, orden y etiquetas                                          */
/* ------------------------------------------------------------------ */

describe("auditConsultation — puntaje y orden", () => {
  it("resta según severidad y nunca baja de 0", () => {
    // 1 crítico (secciones vacías firmada) + 1 crítico (sin dx firmada, cerrada)
    // + sugerencias → puntaje piso 0 posible.
    const report = auditConsultation({
      estado: "exportada",
      motivo: "",
      resumen: "",
      note: [texto("a", "A", ""), texto("b", "B", "")],
      codigos: [],
      firma: { por: "Dra. X" },
    });
    expect(report.puntaje).toBeGreaterThanOrEqual(0);
    expect(report.puntaje).toBeLessThan(100);
    expect(report.criticos).toBeGreaterThanOrEqual(1);
  });

  it("ordena crítico antes que advertencia antes que sugerencia", () => {
    const report = auditConsultation({
      estado: "aprobada", // cerrada → sin dx es crítico
      motivo: "", // advertencia
      resumen: "", // sugerencia
      note: [texto("a", "Motivo de consulta", "Contenido suficiente para no ser breve.")],
      codigos: [],
      firma: null,
    });
    const ranks = report.hallazgos.map((h) => auditSeverityRank(h.severidad));
    const ordenado = [...ranks].sort((a, b) => a - b);
    expect(ranks).toEqual(ordenado);
  });

  it("auditSummaryLabel pluraliza y une con ·", () => {
    const report = auditConsultation({
      estado: "aprobada",
      motivo: "",
      resumen: "",
      note: [texto("a", "A", "")],
      codigos: [],
      firma: null,
    });
    const label = auditSummaryLabel(report);
    expect(label).toMatch(/crítico/);
    expect(label).toContain("·");
  });
});

/* ------------------------------------------------------------------ */
/* Compatibilidad estructural con Consultation                         */
/* ------------------------------------------------------------------ */

describe("compatibilidad de tipos", () => {
  it("acepta un objeto con la forma de Consultation", () => {
    const c: Pick<
      Consultation,
      "estado" | "motivo" | "resumen" | "note" | "codigos" | "firma"
    > = {
      estado: "borrador",
      motivo: "Control",
      resumen: "Estable.",
      note: [texto("a", "Motivo de consulta", "Acude a control de rutina programado.")],
      codigos: [code({ sistema: "CIE-10", estado: "aceptado" })],
      firma: undefined,
    };
    const report = auditConsultation(c);
    // Solo faltaría CUPS (sugerencia).
    expect(report.criticos).toBe(0);
    expect(report.hallazgos.every((h) => h.severidad !== "critico")).toBe(true);
  });
});
