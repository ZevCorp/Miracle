import { describe, it, expect } from "vitest";
import {
  buildTranscriptWithSectionDrafts,
  countSectionDrafts,
  hasSectionDrafts,
  normalizeSectionDrafts,
  SECTION_DRAFTS_MARKER,
  stripSectionDraftsBlock,
} from "@/lib/clinical/section-drafts";
import type { ClinicalTemplateSection } from "@/lib/api/clinical";

const SECCIONES: ClinicalTemplateSection[] = [
  { key: "motivo_de_consulta", label: "Motivo de consulta", order: 1 },
  { key: "enfermedad_actual", label: "Enfermedad actual", order: 2 },
  { key: "analisis_e_impresion_diagnostica", label: "Análisis e impresión diagnóstica", order: 3 },
  { key: "plan_y_educacion", label: "Plan de manejo y educación", order: 4 },
];

const TRANSCRIPCION = "Buenas tardes, ¿qué la trae por acá? Vengo por dolor de cabeza.";

describe("normalizeSectionDrafts", () => {
  it("descarta lo que solo son espacios", () => {
    expect(
      normalizeSectionDrafts({ a: "  ", b: "\n\t", c: " texto real " }),
    ).toEqual({ c: "texto real" });
  });

  it("aguanta nulo y vacío", () => {
    expect(normalizeSectionDrafts(null)).toEqual({});
    expect(normalizeSectionDrafts(undefined)).toEqual({});
    expect(hasSectionDrafts(null)).toBe(false);
    expect(countSectionDrafts({ a: "", b: "x" })).toBe(1);
  });
});

/* Caso A del encargo: si el médico no escribe nada, todo sigue como antes. */
describe("Caso A · sin anotaciones", () => {
  it("devuelve la MISMA transcripción, sin añadir nada", () => {
    expect(buildTranscriptWithSectionDrafts(TRANSCRIPCION, {}, SECCIONES)).toBe(TRANSCRIPCION);
    expect(buildTranscriptWithSectionDrafts(TRANSCRIPCION, null, SECCIONES)).toBe(TRANSCRIPCION);
    // Solo espacios tampoco cuenta como anotación.
    expect(buildTranscriptWithSectionDrafts(TRANSCRIPCION, { plan_y_educacion: "   " }, SECCIONES))
      .toBe(TRANSCRIPCION);
  });
});

/* Caso B · una sola sección anotada. */
describe("Caso B · una sección", () => {
  const salida = buildTranscriptWithSectionDrafts(
    TRANSCRIPCION,
    { analisis_e_impresion_diagnostica: "Sospecha de cáncer. Solicitar exámenes diagnósticos." },
    SECCIONES,
  );

  it("conserva la transcripción intacta al principio", () => {
    expect(salida.startsWith(TRANSCRIPCION)).toBe(true);
  });

  it("rotula la línea con la sección a la que pertenece", () => {
    expect(salida).toContain(
      "[Análisis e impresión diagnóstica] Sospecha de cáncer. Solicitar exámenes diagnósticos.",
    );
  });

  it("dice que se escribió y no se habló, para no falsear el origen", () => {
    expect(salida).toContain(SECTION_DRAFTS_MARKER);
    expect(salida).toContain("no se dijeron en voz alta");
  });

  it("pide integrarlas, no pegarlas como lista", () => {
    expect(salida).toContain("No las copies tal cual como una lista aparte");
  });

  it("no nombra ninguna otra sección", () => {
    expect(salida).not.toContain("[Motivo de consulta]");
    expect(salida).not.toContain("[Plan de manejo y educación]");
  });
});

/* Caso C · varias secciones, cada una en su sitio. */
describe("Caso C · varias secciones", () => {
  const salida = buildTranscriptWithSectionDrafts(
    TRANSCRIPCION,
    {
      // A propósito en desorden: debe salir en el orden de la plantilla.
      plan_y_educacion: "Control en 8 días.",
      motivo_de_consulta: "Refiere cefalea de 3 días.",
    },
    SECCIONES,
  );

  it("respeta el orden de la plantilla, no el de escritura", () => {
    expect(salida.indexOf("[Motivo de consulta]")).toBeLessThan(
      salida.indexOf("[Plan de manejo y educación]"),
    );
  });

  it("mantiene cada texto con su sección", () => {
    expect(salida).toContain("[Motivo de consulta] Refiere cefalea de 3 días.");
    expect(salida).toContain("[Plan de manejo y educación] Control en 8 días.");
  });
});

/* Caso E · la plantilla manda; nada está amarrado a una estructura concreta. */
describe("Caso E · plantillas distintas", () => {
  it("usa las secciones de la plantilla que le pasen", () => {
    const otras: ClinicalTemplateSection[] = [
      { key: "descripcion_macroscopica", label: "Descripción macroscópica", order: 1 },
      { key: "diagnostico", label: "Diagnóstico", order: 2 },
    ];
    const salida = buildTranscriptWithSectionDrafts(
      TRANSCRIPCION,
      { diagnostico: "Compatible con adenocarcinoma." },
      otras,
    );
    expect(salida).toContain("[Diagnóstico] Compatible con adenocarcinoma.");
  });

  it("no pierde una anotación cuya sección ya no está en la plantilla", () => {
    // Pasa al regenerar con otra plantilla: perder lo escrito sería lo peor.
    const salida = buildTranscriptWithSectionDrafts(
      TRANSCRIPCION,
      { seccion_que_ya_no_existe: "Dato que el médico no quiere perder." },
      SECCIONES,
    );
    expect(salida).toContain("[seccion_que_ya_no_existe] Dato que el médico no quiere perder.");
  });
});

describe("forma del bloque", () => {
  it("aplana los saltos de línea: una anotación es una línea", () => {
    const salida = buildTranscriptWithSectionDrafts(
      TRANSCRIPCION,
      { plan_y_educacion: "Primera línea.\n\nSegunda línea.\n  Tercera." },
      SECCIONES,
    );
    expect(salida).toContain(
      "[Plan de manejo y educación] Primera línea. Segunda línea. Tercera.",
    );
  });

  it("no deja la transcripción pegada al bloque", () => {
    const salida = buildTranscriptWithSectionDrafts(
      `${TRANSCRIPCION}   \n\n  `,
      { motivo_de_consulta: "Cefalea." },
      SECCIONES,
    );
    expect(salida).toContain(`${TRANSCRIPCION}\n\n${SECTION_DRAFTS_MARKER}`);
  });
});

/* Regenerar no puede duplicar lo que el médico escribió. */
describe("stripSectionDraftsBlock · regenerar sin duplicar", () => {
  it("quita un bloque ya añadido y deja la transcripción original", () => {
    const conBloque = buildTranscriptWithSectionDrafts(
      TRANSCRIPCION,
      { motivo_de_consulta: "Cefalea." },
      SECCIONES,
    );
    expect(stripSectionDraftsBlock(conBloque)).toBe(TRANSCRIPCION);
  });

  it("deja intacta una transcripción que nunca tuvo bloque", () => {
    expect(stripSectionDraftsBlock(TRANSCRIPCION)).toBe(TRANSCRIPCION);
  });

  it("generar dos veces seguidas no acumula bloques", () => {
    const drafts = { motivo_de_consulta: "Cefalea." };
    const primera = buildTranscriptWithSectionDrafts(TRANSCRIPCION, drafts, SECCIONES);
    const segunda = buildTranscriptWithSectionDrafts(
      stripSectionDraftsBlock(primera),
      drafts,
      SECCIONES,
    );
    expect(segunda).toBe(primera);
    expect(segunda.split(SECTION_DRAFTS_MARKER).length - 1).toBe(1);
  });
});
