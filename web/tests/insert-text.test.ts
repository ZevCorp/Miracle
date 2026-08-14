import { describe, expect, it } from "vitest";
import {
  appendSnippetText,
  insertSnippetText,
  snippetToListItems,
} from "@/lib/clinical/insert-text";

describe("insertSnippetText", () => {
  it("inserta en el cursor sin tocar lo que ya había", () => {
    const result = insertSnippetText("Hola \nmundo", 5, 5, "ATAJO");
    expect(result.next).toBe("Hola ATAJO\nmundo");
    expect(result.next.slice(result.selStart, result.selEnd)).toBe("ATAJO");
  });

  it("reemplaza el texto seleccionado", () => {
    const result = insertSnippetText("Hola mundo", 5, 10, "ATAJO");
    expect(result.next).toBe("Hola ATAJO");
  });

  it("abre línea nueva si el cursor queda pegado a una palabra", () => {
    const result = insertSnippetText("Dolor abdominal", 15, 15, "Gastritis");
    expect(result.next).toBe("Dolor abdominal\nGastritis");
    // La selección apunta al atajo, no al salto de cortesía.
    expect(result.next.slice(result.selStart, result.selEnd)).toBe("Gastritis");
  });

  it("no añade salto si ya venía un espacio o un salto", () => {
    expect(insertSnippetText("Dolor ", 6, 6, "X").next).toBe("Dolor X");
    expect(insertSnippetText("Dolor\n", 6, 6, "X").next).toBe("Dolor\nX");
  });

  it("en un campo vacío inserta tal cual", () => {
    const result = insertSnippetText("", 0, 0, "Gastritis");
    expect(result.next).toBe("Gastritis");
    expect(result.selStart).toBe(0);
  });

  it("tolera posiciones fuera de rango sin perder contenido", () => {
    expect(insertSnippetText("abc", 99, 99, "X").next).toBe("abc\nX");
    expect(insertSnippetText("abc", -5, -5, "X").next).toBe("Xabc");
    // end por detrás de start no debe recortar texto.
    expect(insertSnippetText("abc", 2, 1, "X").next).toBe("ab\nXc");
  });
});

describe("appendSnippetText", () => {
  it("añade al final separando con un salto", () => {
    expect(appendSnippetText("Nota previa.", "Gastritis").next).toBe(
      "Nota previa.\nGastritis",
    );
  });

  it("sobre un campo vacío no antepone nada", () => {
    expect(appendSnippetText("", "Gastritis").next).toBe("Gastritis");
  });
});

describe("snippetToListItems", () => {
  it("convierte cada línea en un punto y le quita la viñeta", () => {
    expect(
      snippetToListItems(
        "- Reposo relativo\n* Hidratación\n• Control en 8 días\n1. Signos de alarma\n2) Volver si empeora",
      ),
    ).toEqual([
      "Reposo relativo",
      "Hidratación",
      "Control en 8 días",
      "Signos de alarma",
      "Volver si empeora",
    ]);
  });

  it("descarta líneas en blanco", () => {
    expect(snippetToListItems("Uno\n\n   \nDos")).toEqual(["Uno", "Dos"]);
  });

  it("no confunde un guion dentro del texto con una viñeta", () => {
    expect(snippetToListItems("Control médico-quirúrgico")).toEqual([
      "Control médico-quirúrgico",
    ]);
  });
});
