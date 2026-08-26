import { describe, expect, it } from "vitest";
import { formatMs, formatPct, resolverFranjaHoraria } from "@/lib/superadmin/metricas";

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
