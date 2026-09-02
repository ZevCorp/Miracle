import { describe, it, expect } from "vitest";
import {
  aplicarDictadoLiteral,
  esRellenoDeSeccion,
  parseVoiceInstruction,
} from "@/lib/clinical/voice-instruction";

describe("dictado literal · el médico anuncia el texto", () => {
  it.each([
    // El ejemplo que pidió el médico, con una cadena sin sentido a propósito:
    // si se interpretara, esto se perdería.
    ["quiero que diga esto: jwdkajdkjawkdjawl", "jwdkajdkjawkdjawl"],
    ["quiero que diga control en ocho días", "control en ocho días"],
    ["que diga: paciente refiere mejoría", "paciente refiere mejoría"],
    ["que quede así: se explica signos de alarma", "se explica signos de alarma"],
    ["necesito que se lea remisión a cardiología", "remisión a cardiología"],
    ["agrega que diga: control en un mes", "control en un mes"],
    ["textualmente: paciente niega fiebre", "paciente niega fiebre"],
    ["escribe literal cefalea tensional", "cefalea tensional"],
    ["anota tal cual: TA 120/80", "TA 120/80"],
    ["escribe esto: amoxicilina 500 miligramos", "amoxicilina 500 miligramos"],
    ["anota lo siguiente: dieta hiposódica", "dieta hiposódica"],
  ])("%j → literal", (dictado, esperado) => {
    expect(parseVoiceInstruction(dictado)).toEqual({ modo: "literal", texto: esperado });
  });

  it("no interpreta ni corrige lo dictado", () => {
    const r = parseVoiceInstruction("quiero que diga esto: jwdkajdkjawkdjawl");
    expect(r).toEqual({ modo: "literal", texto: "jwdkajdkjawkdjawl" });
  });
});

describe("instrucción · el médico pide un cambio", () => {
  it.each([
    "haz esta sección más corta",
    "resume esto en dos frases",
    "ordena los medicamentos por horario",
    "quita la parte del examen físico",
    "corrige la redacción",
  ])("%j → ajuste", (dictado) => {
    expect(parseVoiceInstruction(dictado)).toEqual({ modo: "ajuste", instruccion: dictado });
  });

  it("«agrega que el paciente niega fiebre» no es literal", () => {
    /* Después de "que" viene "el", no un verbo de decir. Si esto cayera en
       literal, la sección terminaría diciendo "el paciente niega fiebre"
       colgando de la nada en vez de redactado. */
    const r = parseVoiceInstruction("agrega que el paciente niega fiebre");
    expect(r?.modo).not.toBe("literal");
  });

  it("un anuncio sin texto detrás no borra la sección", () => {
    // "quiero que diga" y nada más: frase a medias, no dictado vacío.
    expect(parseVoiceInstruction("quiero que diga")?.modo).toBe("ajuste");
  });
});

describe("dictado de un dato · el médico aporta información", () => {
  it.each([
    ["agrega que el paciente niega fiebre", "el paciente niega fiebre"],
    ["anota que trae exámenes de laboratorio", "trae exámenes de laboratorio"],
    ["añade que vuelve a control en ocho días", "vuelve a control en ocho días"],
    ["incluye que no tiene alergias conocidas", "no tiene alergias conocidas"],
    ["registra que la presión fue 120/80", "la presión fue 120/80"],
  ])("%j → dictado", (dictado, esperado) => {
    expect(parseVoiceInstruction(dictado)).toEqual({ modo: "dictado", texto: esperado });
  });

  it("los anuncios de texto ganan al dictado", () => {
    // "agrega que diga" es literal, no dictado: el médico está dictando el texto.
    expect(parseVoiceInstruction("agrega que diga: control en un mes")).toEqual({
      modo: "literal",
      texto: "control en un mes",
    });
    expect(parseVoiceInstruction("anota que quede así: sin cambios")).toEqual({
      modo: "literal",
      texto: "sin cambios",
    });
  });

  it("«agrega que» sin dato detrás es una instrucción a medias", () => {
    expect(parseVoiceInstruction("agrega que")?.modo).toBe("ajuste");
  });

  it("un verbo de cambio con «que» no es dictado", () => {
    expect(parseVoiceInstruction("resume que el plan quede corto")?.modo).toBe("ajuste");
  });
});

describe("dictado vacío", () => {
  it.each(["", "   ", "\n", null, undefined])("%j → null", (dictado) => {
    expect(parseVoiceInstruction(dictado)).toBeNull();
  });
});

describe("esRellenoDeSeccion", () => {
  it.each([
    "",
    "   ",
    "No referido en la consulta.",
    "No mencionado en la consulta.",
    "No documentado en la transcripción.",
    "Sin datos.",
    "No se menciona en la consulta.",
    "Pendiente.",
  ])("%j es relleno", (contenido) => {
    expect(esRellenoDeSeccion(contenido)).toBe(true);
  });

  it.each([
    "Cefalea de tres días de evolución.",
    "TA 120/80, FC 72.",
    "Nombre: Ana Gómez",
    // Un contenido clínico que empieza por "no" pero dice algo.
    "Nota: continúa con el mismo esquema.",
  ])("%j NO es relleno", (contenido) => {
    expect(esRellenoDeSeccion(contenido)).toBe(false);
  });
});

describe("aplicarDictadoLiteral", () => {
  it("sustituye el relleno: la sección estaba vacía de verdad", () => {
    expect(aplicarDictadoLiteral("No referido en la consulta.", "Control en 8 días")).toBe(
      "Control en 8 días",
    );
  });

  it("añade al final cuando ya había contenido clínico", () => {
    expect(aplicarDictadoLiteral("Cefalea de tres días.", "Sin signos de alarma")).toBe(
      "Cefalea de tres días. Sin signos de alarma",
    );
  });

  it("no duplica la puntuación que ya traía", () => {
    expect(aplicarDictadoLiteral("Cefalea de tres días:", "intensidad 7/10")).toBe(
      "Cefalea de tres días: intensidad 7/10",
    );
  });

  it("pone el punto cuando falta", () => {
    expect(aplicarDictadoLiteral("Cefalea de tres días", "sin fiebre")).toBe(
      "Cefalea de tres días. sin fiebre",
    );
  });

  it("nunca borra lo que ya estaba escrito", () => {
    const actual = "Impresión: migraña sin aura.";
    expect(aplicarDictadoLiteral(actual, "solicitar TAC")).toContain(actual);
  });

  it("un dictado vacío deja la sección como estaba", () => {
    expect(aplicarDictadoLiteral("Cefalea.", "   ")).toBe("Cefalea.");
  });
});
