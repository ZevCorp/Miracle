import { describe, expect, it } from "vitest";
import {
  applySuggestions,
  chunk,
  rowsToSave,
  type ImportRow,
} from "@/lib/clinical/snippet-import";

function row(overrides: Partial<ImportRow> & { tempId: string }): ImportRow {
  return {
    filename: `${overrides.tempId}.docx`,
    title: `Archivo ${overrides.tempId}`,
    category: "",
    content: "Contenido",
    include: true,
    ...overrides,
  };
}

describe("chunk", () => {
  it("parte en tandas del tamaño pedido", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("con menos elementos que el tamaño devuelve una sola tanda", () => {
    expect(chunk([1, 2], 25)).toEqual([[1, 2]]);
    expect(chunk([], 25)).toEqual([]);
  });
});

describe("applySuggestions", () => {
  const rows = [row({ tempId: "f0" }), row({ tempId: "f1" })];

  it("aplica título y categoría a la fila que corresponde", () => {
    const result = applySuggestions(rows, [
      { id: "f1", titulo: "Gastritis crónica", categoria: "Diagnóstico" },
    ]);
    expect(result[0].title).toBe("Archivo f0");
    expect(result[1]).toMatchObject({
      title: "Gastritis crónica",
      category: "Diagnóstico",
    });
  });

  it("ignora ids que no estaban en la lista", () => {
    const result = applySuggestions(rows, [
      { id: "inventado", titulo: "X", categoria: "Y" },
    ]);
    expect(result.map((r) => r.title)).toEqual(["Archivo f0", "Archivo f1"]);
  });

  it("no toca las filas con error de lectura", () => {
    const conError = [row({ tempId: "f0", error: "No se pudo leer." })];
    const result = applySuggestions(conError, [
      { id: "f0", titulo: "Propuesto", categoria: "Plan" },
    ]);
    expect(result[0].title).toBe("Archivo f0");
  });

  it("una sugerencia vacía conserva lo que ya había", () => {
    const result = applySuggestions([row({ tempId: "f0", category: "Plan" })], [
      { id: "f0", titulo: "   ", categoria: "" },
    ]);
    expect(result[0]).toMatchObject({ title: "Archivo f0", category: "Plan" });
  });
});

describe("rowsToSave", () => {
  it("solo guarda lo marcado, legible y con título", () => {
    const result = rowsToSave([
      row({ tempId: "ok" }),
      row({ tempId: "desmarcado", include: false }),
      row({ tempId: "roto", error: "No se pudo leer." }),
      row({ tempId: "sin-titulo", title: "  " }),
      row({ tempId: "vacio", content: "   " }),
    ]);
    expect(result).toEqual([
      { title: "Archivo ok", content: "Contenido", category: "" },
    ]);
  });
});
