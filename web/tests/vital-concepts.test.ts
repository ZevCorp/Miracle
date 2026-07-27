import { describe, expect, it } from "vitest";

import {
  conceptsRevision,
  extractConcepts,
  noteToText,
} from "@/lib/clinical/vital-concepts";
/** Forma del store local (`texto`). La del backend clínico (`content`) se prueba aparte. */
function note(...textos: string[]) {
  return textos.map((texto) => ({ texto }));
}

describe("extractConcepts", () => {
  it("lee los signos vitales de una nota dictada", () => {
    const c = extractConcepts(
      note(
        "Paciente masculino de 68 años.",
        "Talla 1.70 metros, peso 57 kilos. Presión arterial 120 sobre 80.",
        "Frecuencia cardíaca 88 por minuto. Frecuencia respiratoria 18. Temperatura 36.5 grados. Saturación de oxígeno 94 por ciento.",
      ),
    );

    expect(c["paciente.edad"]?.value).toBe("68");
    expect(c["vital.talla"]?.value).toBe("1.70");
    expect(c["vital.peso"]?.value).toBe("57.0");
    expect(c["vital.presion.sistolica"]?.value).toBe("120");
    expect(c["vital.presion.diastolica"]?.value).toBe("80");
    expect(c["vital.frecuencia.cardiaca"]?.value).toBe("88");
    expect(c["vital.frecuencia.respiratoria"]?.value).toBe("18");
    expect(c["vital.temperatura"]?.value).toBe("36.5");
    expect(c["vital.saturacion"]?.value).toBe("94");
  });

  it("acepta las abreviaturas que se usan al dictar", () => {
    const c = extractConcepts(note("TA 130/85, FC: 72 x min, FR 16, Temp 37.2, SatO2 97%"));
    expect(c["vital.presion.sistolica"]?.value).toBe("130");
    expect(c["vital.presion.diastolica"]?.value).toBe("85");
    expect(c["vital.frecuencia.cardiaca"]?.value).toBe("72");
    expect(c["vital.frecuencia.respiratoria"]?.value).toBe("16");
    expect(c["vital.temperatura"]?.value).toBe("37.2");
    expect(c["vital.saturacion"]?.value).toBe("97");
  });

  it("normaliza la talla dictada en centímetros", () => {
    expect(extractConcepts(note("Talla 170 cm"))["vital.talla"]?.value).toBe("1.70");
  });

  it("acepta la coma decimal", () => {
    expect(extractConcepts(note("Temperatura 36,8"))["vital.temperatura"]?.value).toBe("36.8");
  });

  // ── Lo que NO debe hacer. Es la mitad que importa en un sistema clínico ──────

  it("NO toma números sueltos sin su etiqueta", () => {
    expect(extractConcepts(note("El paciente refiere 57 y 120."))).toEqual({});
  });

  it("descarta lo que está fuera de rango plausible", () => {
    // 896 estaba escrito en «Frec. Cardíaca» en la pantalla real de pruebas.
    const c = extractConcepts(note("Frecuencia cardíaca 896. Temperatura 30 grados."));
    expect(c["vital.frecuencia.cardiaca"]).toBeUndefined();
    expect(c["vital.temperatura"]?.value).toBe("30.0"); // 30 sí es plausible, aunque grave
  });

  it("descarta la presión si viene invertida: es una mala lectura, no un paciente raro", () => {
    const c = extractConcepts(note("Presión arterial 80 sobre 120"));
    expect(c["vital.presion.sistolica"]).toBeUndefined();
    expect(c["vital.presion.diastolica"]).toBeUndefined();
  });

  it("no cruza el punto: una etiqueta no captura el número de la frase siguiente", () => {
    // Sin frontera, «peso» alcanzaría el 36.5 de la temperatura.
    expect(extractConcepts(note("Peso no registrado. Temperatura 36.5"))["vital.peso"]).toBeUndefined();
  });

  it("devuelve vacío con nota vacía o ausente", () => {
    expect(extractConcepts([])).toEqual({});
    expect(extractConcepts(null)).toEqual({});
    expect(extractConcepts(undefined)).toEqual({});
  });

  it("guarda la evidencia de cada valor", () => {
    const c = extractConcepts(note("Talla 1.70 metros"));
    expect(c["vital.talla"]?.evidence).toContain("Talla 1.70");
  });
});

describe("conceptsRevision", () => {
  it("cambia cuando cambia un valor y no cuando no", () => {
    const a = extractConcepts(note("Peso 57 kilos"));
    const b = extractConcepts(note("Peso 57 kilos"));
    const c = extractConcepts(note("Peso 58 kilos"));

    expect(conceptsRevision(a)).toBe(conceptsRevision(b));
    expect(conceptsRevision(a)).not.toBe(conceptsRevision(c));
  });

  it("no depende del orden de las llaves", () => {
    const uno = extractConcepts(note("Peso 57 kilos. Talla 1.70 metros."));
    const otro = extractConcepts(note("Talla 1.70 metros. Peso 57 kilos."));
    expect(conceptsRevision(uno)).toBe(conceptsRevision(otro));
  });

  it("sin conceptos devuelve una revisión estable", () => {
    expect(conceptsRevision({})).toBe("0");
  });
});

describe("noteToText", () => {
  it("junta texto e items y descarta secciones vacías", () => {
    const t = noteToText([{ texto: "hola" }, { items: ["uno", "dos"] }, { texto: "  " }]);
    expect(t).toBe("hola\nuno\ndos");
  });

  // La nota del backend clínico usa `content`. Es la que existe MIENTRAS se dicta, o
  // sea la única que importa para el agente: leer solo `texto` devolvía vacío en vivo.
  it("lee también la forma del backend clínico (`content`)", () => {
    expect(noteToText([{ content: "Talla 1.70 metros" }])).toBe("Talla 1.70 metros");
  });

  it("extrae conceptos de la nota en vivo", () => {
    const c = extractConcepts([{ content: "TA 118/76, FC 64, Temp 36.4" }]);
    expect(c["vital.presion.sistolica"]?.value).toBe("118");
    expect(c["vital.frecuencia.cardiaca"]?.value).toBe("64");
    expect(c["vital.temperatura"]?.value).toBe("36.4");
  });
});
