import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  etiquetaPeriodoAnterior,
  limitesIso,
  resolverRango,
} from "@/lib/superadmin/rango";

// 2026-08-03 19:00 UTC = 14:00 en Bogotá. La suite corre con TZ=UTC.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-03T19:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("presets", () => {
  it("por defecto son 30 días terminando hoy", () => {
    const r = resolverRango({});
    expect(r.clave).toBe("30");
    expect(r.hasta).toBe("2026-08-03");
    expect(r.desde).toBe("2026-07-05");
    expect(r.dias).toBe(30);
    expect(r.etiqueta).toBe("Últimos 30 días");
  });

  it("resuelve cada preset a fechas concretas", () => {
    expect(resolverRango({ rango: "7" }).desde).toBe("2026-07-28");
    expect(resolverRango({ rango: "90" }).desde).toBe("2026-05-06");
    expect(resolverRango({ rango: "365" }).dias).toBe(365);
  });

  it("el periodo anterior es la ventana inmediatamente previa del mismo largo", () => {
    const r = resolverRango({ rango: "7" });
    expect(r.hastaPrevio).toBe("2026-07-27");
    expect(r.desdePrevio).toBe("2026-07-21");
    expect(r.dias).toBe(7);
  });

  it("el rango por defecto no ensucia la URL", () => {
    expect(resolverRango({}).params).toEqual({});
    expect(resolverRango({ rango: "7" }).params).toEqual({ rango: "7" });
  });

  it("usa el día de Bogotá y no el de UTC en la frontera", () => {
    // 02:00 UTC del 4 son las 21:00 del 3 en Bogotá: "hoy" sigue siendo el 3.
    vi.setSystemTime(new Date("2026-08-04T02:00:00Z"));
    expect(resolverRango({}).hasta).toBe("2026-08-03");
  });
});

describe("rango personalizado", () => {
  it("acepta un rango válido y lo etiqueta con las dos fechas", () => {
    const r = resolverRango({ rango: "custom", desde: "2026-06-18", hasta: "2026-07-02" });
    expect(r.clave).toBe("custom");
    expect(r.dias).toBe(15);
    expect(r.etiqueta).toBe("18/06/2026 – 02/07/2026");
    expect(r.params).toEqual({ rango: "custom", desde: "2026-06-18", hasta: "2026-07-02" });
  });

  it("recorta el futuro hasta hoy", () => {
    const r = resolverRango({ rango: "custom", desde: "2026-08-01", hasta: "2030-01-01" });
    expect(r.hasta).toBe("2026-08-03");
  });

  it("recorta un rango más largo que el tope de 366 días", () => {
    const r = resolverRango({ rango: "custom", desde: "2020-01-01", hasta: "2026-08-03" });
    expect(r.dias).toBe(366);
    expect(r.hasta).toBe("2026-08-03");
  });

  it("un solo día es un rango válido", () => {
    const r = resolverRango({ rango: "custom", desde: "2026-07-01", hasta: "2026-07-01" });
    expect(r.dias).toBe(1);
    expect(etiquetaPeriodoAnterior(r)).toBe("vs. el día anterior");
  });
});

describe("entradas inválidas: siempre caen al defecto, nunca lanzan", () => {
  const basura = [
    { rango: "xyz" },
    { rango: "custom" },
    { rango: "custom", desde: "no-es-fecha", hasta: "2026-08-01" },
    { rango: "custom", desde: "2026-08-01", hasta: "2026-07-01" }, // invertido
    { rango: "custom", desde: "2026-02-31", hasta: "2026-03-05" }, // día inexistente
    { rango: "0" },
    { rango: "-7" },
  ];

  for (const sp of basura) {
    it(`cae a 30 días con ${JSON.stringify(sp)}`, () => {
      const r = resolverRango(sp);
      expect(r.clave).toBe("30");
      expect(r.dias).toBe(30);
    });
  }
});

describe("limitesIso", () => {
  it("da un intervalo medio-abierto anclado a la medianoche de Bogotá", () => {
    const { desdeIso, hastaIso } = limitesIso({ desde: "2026-07-05", hasta: "2026-08-03" });
    expect(desdeIso).toBe("2026-07-05T00:00:00-05:00");
    // El fin es el día siguiente al último: así el 3 de agosto entra completo.
    expect(hastaIso).toBe("2026-08-04T00:00:00-05:00");
  });

  it("la medianoche de Bogotá son las 05:00 UTC", () => {
    const { desdeIso } = limitesIso({ desde: "2026-07-05", hasta: "2026-07-05" });
    expect(new Date(desdeIso).toISOString()).toBe("2026-07-05T05:00:00.000Z");
  });
});
