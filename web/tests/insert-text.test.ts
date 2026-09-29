import { describe, expect, it } from "vitest";
import {
  appendSnippetText,
  insertSnippetText,
  snippetToListItems,
  caretAfterDictation,
  shouldFollowDictation,
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

describe("caretAfterDictation", () => {
  it("con el cursor al final, lo deja seguir al texto dictado", () => {
    // Quien escribe a la par del dictado espera quedar pegado a lo último.
    expect(caretAfterDictation({ start: 40, end: 40 }, 40)).toBeNull();
  });

  it("corrigiendo a mitad del texto, el cursor no se mueve", () => {
    // Este es el caso que obligaba a bloquear el campo: el médico corrige una
    // cifra en la línea 2 y un segmento nuevo le mandaba el cursor al final.
    expect(caretAfterDictation({ start: 12, end: 12 }, 40)).toEqual({
      start: 12,
      end: 12,
    });
  });

  it("conserva una selección hecha a mitad del texto", () => {
    expect(caretAfterDictation({ start: 5, end: 18 }, 40)).toEqual({
      start: 5,
      end: 18,
    });
  });

  it("una selección que llega hasta el final sigue al texto nuevo", () => {
    expect(caretAfterDictation({ start: 40, end: 45 }, 40)).toBeNull();
  });

  it("sobre un campo vacío no hay nada que restaurar", () => {
    expect(caretAfterDictation({ start: 0, end: 0 }, 0)).toBeNull();
  });
});

describe("shouldFollowDictation", () => {
  // Un cuadro de 200px de alto con 1000px de contenido: el fondo esta en 800.
  const alFondo = { scrollTop: 800, scrollHeight: 1000, clientHeight: 200 };
  const subidoALeer = { scrollTop: 120, scrollHeight: 1000, clientHeight: 200 };

  it("mirando el final, el cuadro sigue bajando", () => {
    expect(shouldFollowDictation(alFondo, false)).toBe(true);
  });

  it("a una linea del fondo todavia cuenta como mirar el final", () => {
    // Nadie deja el scroll clavado al pixel.
    expect(shouldFollowDictation({ ...alFondo, scrollTop: 780 }, false)).toBe(true);
  });

  it("si se subio a releer, no lo arrastra al fondo", () => {
    expect(shouldFollowDictation(subidoALeer, false)).toBe(false);
  });

  it("corrigiendo a mitad del texto no se mueve, aunque este al fondo", () => {
    // Mover la vista mientras escribe le esconde lo que esta escribiendo.
    expect(shouldFollowDictation(alFondo, true)).toBe(false);
  });

  it("un cuadro sin nada que desplazar no estorba", () => {
    expect(
      shouldFollowDictation({ scrollTop: 0, scrollHeight: 200, clientHeight: 200 }, false),
    ).toBe(true);
  });
});
