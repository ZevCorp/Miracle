import { describe, expect, it } from "vitest";
import {
  findPlaceholders,
  firstPlaceholderIn,
  nextPlaceholderAfter,
} from "@/lib/clinical/placeholders";

/** Devuelve el texto de cada hueco, que es más legible que sus posiciones. */
function huecos(text: string) {
  return findPlaceholders(text).map((h) => text.slice(h.start, h.end));
}

describe("findPlaceholders", () => {
  it("encuentra corchetes y guiones bajos, en orden", () => {
    expect(
      huecos("Amoxicilina [dosis] cada [frecuencia] horas por ___ días"),
    ).toEqual(["[dosis]", "[frecuencia]", "___"]);
  });

  it("exige tres guiones bajos: dos no son un hueco", () => {
    expect(huecos("__ no; ___ sí")).toEqual(["___"]);
    expect(huecos("_____")).toEqual(["_____"]);
  });

  it("ignora corchetes vacíos o demasiado largos", () => {
    expect(huecos("[]")).toEqual([]);
    expect(huecos(`[${"a".repeat(41)}]`)).toEqual([]);
    expect(huecos(`[${"a".repeat(40)}]`)).toHaveLength(1);
  });

  it("no cruza saltos de línea ni corchetes anidados", () => {
    expect(huecos("[uno\ndos]")).toEqual([]);
    expect(huecos("[a[b]")).toEqual(["[b]"]);
  });

  it("no marca texto clínico normal", () => {
    expect(huecos("Dolor 7/10, control en 8 días... pendiente TAC")).toEqual([]);
  });

  it("no arrastra estado entre llamadas", () => {
    const texto = "[a] y [b]";
    expect(huecos(texto)).toEqual(["[a]", "[b]"]);
    expect(huecos(texto)).toEqual(["[a]", "[b]"]);
  });
});

describe("nextPlaceholderAfter", () => {
  const texto = "Tomar [dosis] cada ___ horas";

  it("encuentra el primero desde el principio", () => {
    const hueco = nextPlaceholderAfter(texto, 0)!;
    expect(texto.slice(hueco.start, hueco.end)).toBe("[dosis]");
  });

  it("desde el final del primero salta al siguiente", () => {
    const primero = nextPlaceholderAfter(texto, 0)!;
    const segundo = nextPlaceholderAfter(texto, primero.end)!;
    expect(texto.slice(segundo.start, segundo.end)).toBe("___");
  });

  it("devuelve null cuando ya no quedan (y Tab vuelve a ser Tab)", () => {
    expect(nextPlaceholderAfter(texto, texto.length)).toBeNull();
    expect(nextPlaceholderAfter("Sin huecos", 0)).toBeNull();
  });
});

describe("firstPlaceholderIn", () => {
  const texto = "[previo] ya escrito. Tomar [dosis] cada ___ horas";
  const inicioInsertado = texto.indexOf("Tomar");

  it("solo mira dentro de lo que se acaba de insertar", () => {
    const hueco = firstPlaceholderIn(texto, inicioInsertado, texto.length)!;
    expect(texto.slice(hueco.start, hueco.end)).toBe("[dosis]");
  });

  it("no devuelve un hueco que se sale del rango", () => {
    expect(firstPlaceholderIn(texto, inicioInsertado, texto.indexOf("[dosis]") + 3)).toBeNull();
  });

  it("null si lo insertado no traía huecos", () => {
    expect(firstPlaceholderIn("Texto sin huecos", 0, 16)).toBeNull();
  });
});
