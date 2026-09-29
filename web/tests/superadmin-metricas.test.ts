import { describe, expect, it } from "vitest";
import {
  formatDelta,
  formatMs,
  formatPct,
  formatSeg,
  resolverFranjaHoraria,
} from "@/lib/superadmin/metricas";

// Regla de oro heredada de resolverRango: una URL inválida NUNCA lanza; cae a
// "sin franja". Y NULL significa "no medido", jamás se pinta como cero.

describe("resolverFranjaHoraria", () => {
  it("franja completa válida", () => {
    expect(resolverFranjaHoraria({ hdesde: "8", hhasta: "12" })).toEqual({
      desde: 8,
      hasta: 12,
      etiqueta: "8:00 – 12:00",
    });
  });

  it("cruzar la medianoche es válido (turno nocturno)", () => {
    const f = resolverFranjaHoraria({ hdesde: "22", hhasta: "6" });
    expect(f.desde).toBe(22);
    expect(f.hasta).toBe(6);
  });

  it("un solo extremo no define franja", () => {
    expect(resolverFranjaHoraria({ hdesde: "8" }).desde).toBeNull();
    expect(resolverFranjaHoraria({ hhasta: "12" }).hasta).toBeNull();
  });

  it("valores inválidos caen a sin franja, sin lanzar", () => {
    expect(resolverFranjaHoraria({ hdesde: "25", hhasta: "12" }).desde).toBeNull();
    expect(resolverFranjaHoraria({ hdesde: "-1", hhasta: "12" }).desde).toBeNull();
    expect(resolverFranjaHoraria({ hdesde: "ocho", hhasta: "12" }).desde).toBeNull();
    // Misma hora en ambos extremos = franja vacía = sin franja.
    expect(resolverFranjaHoraria({ hdesde: "8", hhasta: "8" }).desde).toBeNull();
  });
});

describe("formatMs", () => {
  it("formatea por orden de magnitud", () => {
    expect(formatMs(45_000)).toBe("45s");
    expect(formatMs(1_112_000)).toBe("18m 32s");
    expect(formatMs(3_840_000)).toBe("1h 04m");
  });

  it("NULL es no disponible, no cero", () => {
    expect(formatMs(null)).toBe("—");
    expect(formatMs(undefined)).toBe("—");
    expect(formatMs(0)).toBe("0s");
  });
});

describe("formatPct", () => {
  it("distingue no medido de cero", () => {
    expect(formatPct(null)).toBe("—");
    expect(formatPct(0)).toBe("0%");
    expect(formatPct(37.4)).toBe("37%");
  });
});

// Los formateadores del bloque de calidad de nota. Todos comparten la misma
// regla que el resto de la consola: NULL es "no medido" y se dice, nunca se
// pinta como cero.

describe("formatSeg", () => {
  it("segundos a forma legible", () => {
    expect(formatSeg(95)).toBe("1m 35s");
    expect(formatSeg(45)).toBe("45s");
  });

  it("no medido se dice, no se inventa", () => {
    expect(formatSeg(null)).toBe("—");
    expect(formatSeg(undefined)).toBe("—");
  });

  it("cero segundos es cero, no 'sin dato'", () => {
    // Una nota que salió instantánea es un dato real; borrarlo escondería el
    // caso más interesante.
    expect(formatSeg(0)).toBe("0s");
  });
});

describe("formatDelta", () => {
  it("lo que el médico AÑADE lleva signo explícito", () => {
    // Sin el "+", 148 se lee como un total de caracteres y no como un saldo.
    expect(formatDelta(148)).toBe("+148");
  });

  it("recortar sale en negativo", () => {
    expect(formatDelta(-90)).toBe("-90");
  });

  it("cero neto no lleva signo", () => {
    expect(formatDelta(0)).toBe("0");
  });

  it("sin dato, guion", () => {
    expect(formatDelta(null)).toBe("—");
  });
});
