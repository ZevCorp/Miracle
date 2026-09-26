import { describe, expect, it } from "vitest";
import type { ClinicalNoteJson } from "@/lib/api/clinical";
import { noteAsPlainText, noteSections } from "@/lib/clinical/note-plain-text";

// Lo que copia «Copiar nota». Miracle para Windows copia con el mismo formato
// (spec 055 de U-Windows-App); si esto cambia, allí tiene que cambiar también.

function nota(parcial: Partial<ClinicalNoteJson>): ClinicalNoteJson {
  return {
    summary: "",
    sections: [],
    warnings: [],
    missing_required_sections: [],
    ...parcial,
  };
}

describe("noteAsPlainText", () => {
  it("resumen, secciones y el cierre, separados por una línea en blanco", () => {
    const texto = noteAsPlainText(
      nota({
        summary: "Dolor torácico atípico.",
        sections: [{ key: "motivo", label: "Motivo de consulta", content: "Dolor en el pecho" }],
        discharge: {
          plan: {
            medications: [
              { name: "Acetaminofén", dose: "500 mg", route: "VO", frequency: "cada 8 h", duration: "3 días", instructions: "" },
            ],
            non_pharmacological: [{ text: "Reposo relativo" }],
            follow_up: [{ text: "Control en 8 días" }],
          },
          recommendations: [{ text: "Hidratación" }],
          alarm_signs: [{ text: "Dolor que no cede" }],
        },
      } as Partial<ClinicalNoteJson>),
    );
    expect(texto).toBe(
      [
        "Resumen\nDolor torácico atípico.",
        "Motivo de consulta\nDolor en el pecho",
        "Plan terapéutico\nAcetaminofén · 500 mg · VO · cada 8 h · 3 días\nReposo relativo\nControl en 8 días",
        "Recomendaciones\nHidratación",
        "Signos de alarma\nDolor que no cede",
      ].join("\n\n"),
    );
  });

  it("lo vacío se dice «Sin información documentada.» en vez de desaparecer", () => {
    const secciones = noteSections(nota({ sections: [{ key: "a", label: "Examen", content: "  " }] } as Partial<ClinicalNoteJson>));
    expect(secciones.map((s) => s.content)).toEqual(Array(5).fill("Sin información documentada."));
  });
});
