import { describe, expect, it } from "vitest";
import { slashQueryAt } from "@/lib/clinical/slash-trigger";

/** Escribe `value` y pone el cursor donde está el "|". */
function at(withCaret: string) {
  const caret = withCaret.indexOf("|");
  return slashQueryAt(withCaret.replace("|", ""), caret);
}

describe("slashQueryAt", () => {
  it("dispara al principio del campo", () => {
    expect(at("/gastr|")).toEqual({ query: "gastr", start: 0 });
  });

  it("dispara después de un espacio", () => {
    expect(at("Paciente con /gastr|")).toEqual({ query: "gastr", start: 13 });
  });

  it("dispara después de un salto de línea", () => {
    expect(at("Plan:\n/omep|")).toEqual({ query: "omep", start: 6 });
  });

  it("la barra sola abre la lista completa", () => {
    expect(at("/|")).toEqual({ query: "", start: 0 });
  });

  it("NO dispara con una tensión arterial", () => {
    expect(at("TA 120/80|")).toBeNull();
  });

  it("NO dispara con abreviaturas ni unidades", () => {
    expect(at("s/p| apendicectomía")).toBeNull();
    expect(at("glicemia 90 mg/dl|")).toBeNull();
  });

  it("NO dispara dentro de una URL", () => {
    expect(at("https://ejemplo.co/guia|")).toBeNull();
  });

  it("se cierra al escribir un espacio", () => {
    expect(at("/gastritis cronica|")).toBeNull();
  });

  it("sigue activo con el cursor a mitad del token", () => {
    expect(at("/gas|tritis")).toEqual({ query: "gas", start: 0 });
  });

  it("sin barra no hay token", () => {
    expect(at("gastritis|")).toBeNull();
    expect(at("|")).toBeNull();
  });

  it("abandona si la búsqueda es demasiado larga para serlo", () => {
    expect(at(`/${"a".repeat(41)}|`)).toBeNull();
    expect(at(`/${"a".repeat(40)}|`)).not.toBeNull();
  });

  it("toma la barra más cercana al cursor", () => {
    expect(at("/uno /dos|")).toEqual({ query: "dos", start: 5 });
  });

  it("ignora posiciones de cursor imposibles", () => {
    expect(slashQueryAt("/gastr", -1)).toBeNull();
    expect(slashQueryAt("/gastr", 99)).toBeNull();
  });
});
