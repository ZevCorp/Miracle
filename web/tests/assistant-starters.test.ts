import { describe, expect, it } from "vitest";
import { starterQuestions, STARTERS_PER_SET } from "@/lib/assistant/starters";

function esUnicoYCompleto(list: string[]) {
  expect(list).toHaveLength(STARTERS_PER_SET);
  expect(new Set(list).size).toBe(list.length);
  for (const item of list) expect(item.length).toBeGreaterThan(10);
}

describe("starterQuestions", () => {
  it("sin consulta: preguntas generales con guía, diferenciales, dosis y criterios", () => {
    const list = starterQuestions({ hasEncounter: false, hasNote: false, hasTranscript: false });
    esUnicoYCompleto(list);
    expect(list.some((q) => /guía/i.test(q))).toBe(true);
    expect(list.some((q) => /dosis/i.test(q))).toBe(true);
  });

  it("sin consulta, por especialidad: dos propias y el resto generales (acepta guion o guion_bajo)", () => {
    const pediatria = starterQuestions({ hasEncounter: false, hasNote: false, hasTranscript: false, specialtyCode: "pediatria" });
    esUnicoYCompleto(pediatria);
    expect(pediatria[0]).toMatch(/deshidrataci/i);
    expect(pediatria[1]).toMatch(/lactante/i);

    const gineco = starterQuestions({ hasEncounter: false, hasNote: false, hasTranscript: false, specialtyCode: "ginecologia-obstetricia" });
    expect(gineco[0]).toMatch(/preeclampsia/i);

    const psiquiatria = starterQuestions({ hasEncounter: false, hasNote: false, hasTranscript: false, specialtyCode: "psiquiatria" });
    expect(psiquiatria[0]).toMatch(/suicida/i);

    const desconocida = starterQuestions({ hasEncounter: false, hasNote: false, hasTranscript: false, specialtyCode: "odontologia" });
    expect(desconocida).toEqual(starterQuestions({ hasEncounter: false, hasNote: false, hasTranscript: false }));
  });

  it("con consulta y nota: preguntas sobre ESTA consulta, incluida la revisión de la nota", () => {
    const list = starterQuestions({ hasEncounter: true, hasNote: true, hasTranscript: true, specialtyCode: "pediatria" });
    esUnicoYCompleto(list);
    expect(list.some((q) => /resume esta consulta/i.test(q))).toBe(true);
    expect(list.some((q) => /revisa la nota/i.test(q))).toBe(true);
    expect(list.some((q) => /amoxicilina/i.test(q))).toBe(false);
  });

  it("con consulta grabándose (sin nota aún): preguntas sobre lo hablado", () => {
    const list = starterQuestions({ hasEncounter: true, hasNote: false, hasTranscript: true });
    esUnicoYCompleto(list);
    expect(list[0]).toMatch(/hablado hasta ahora/i);
  });

  it("con consulta recién creada: preguntas de abordaje del motivo", () => {
    const list = starterQuestions({ hasEncounter: true, hasNote: false, hasTranscript: false });
    esUnicoYCompleto(list);
    expect(list[0]).toMatch(/motivo de consulta/i);
  });
});
