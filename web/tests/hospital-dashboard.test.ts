import { describe, it, expect } from "vitest";
import {
  comparacion,
  comparacionPorcentaje,
  DASHBOARD_VACIO,
  estadoAdopcion,
  etiquetaEstado,
  etiquetaTipo,
  fetchHospitalDashboard,
  type Kpi,
  type MedicoActividad,
} from "@/lib/hospital/dashboard";

const PREVIO = "vs. los 30 días anteriores";

function medico(parcial: Partial<MedicoActividad> = {}): MedicoActividad {
  return {
    medico_id: "m1",
    nombre: "Dra. Ruiz",
    consultas: 10,
    sin_firmar: 0,
    completitud: 80,
    ultima: "2026-08-01T10:00:00Z",
    ...parcial,
  };
}

describe("comparacion", () => {
  it("muestra la variación cuando la base anterior es suficiente", () => {
    const kpi: Kpi = { value: 120, previous: 100, delta_pct: 20 };
    expect(comparacion(kpi, PREVIO)).toEqual({
      deltaPct: 20,
      previousLabel: PREVIO,
    });
  });

  it("no muestra porcentaje sobre una base diminuta: sería +16000%", () => {
    const kpi: Kpi = { value: 322, previous: 2, delta_pct: 16000 };
    const props = comparacion(kpi, PREVIO);
    expect(props.deltaPct).toBeUndefined();
    expect(props.footnote).toBe("antes: 2");
  });

  it("sin ventana anterior no inventa comparación", () => {
    expect(comparacion({ value: 10, previous: 0, delta_pct: null }, PREVIO)).toEqual({
      footnote: "antes: 0",
    });
    expect(comparacion({ value: 10, delta_pct: null }, PREVIO)).toEqual({});
  });

  it("una caída también se reporta", () => {
    const kpi: Kpi = { value: 50, previous: 100, delta_pct: -50 };
    expect(comparacion(kpi, PREVIO).deltaPct).toBe(-50);
  });
});

describe("comparacionPorcentaje", () => {
  it("expresa la diferencia entre porcentajes en puntos, no en %", () => {
    // 89% -> 59% NO es "-34%": restar 34 de 89 daría 55. Son 30 puntos menos.
    expect(comparacionPorcentaje({ value: 59, previous: 89, delta_pct: -34 })).toEqual({
      footnote: "antes: 89% (−30 pts)",
    });
  });

  it("marca la subida con signo positivo", () => {
    expect(comparacionPorcentaje({ value: 80, previous: 60, delta_pct: 33 })).toEqual({
      footnote: "antes: 60% (+20 pts)",
    });
  });

  it("sin cambio no agrega paréntesis", () => {
    expect(comparacionPorcentaje({ value: 60, previous: 60, delta_pct: 0 })).toEqual({
      footnote: "antes: 60%",
    });
  });

  it("sin ventana anterior no muestra nada", () => {
    expect(comparacionPorcentaje({ value: 60, previous: 0, delta_pct: null })).toEqual({});
    expect(comparacionPorcentaje({ value: 60, delta_pct: null })).toEqual({});
  });
});

describe("estadoAdopcion", () => {
  it("al día: documenta y no acumula pendientes", () => {
    expect(estadoAdopcion(medico({ consultas: 10, sin_firmar: 1 }))).toBe("activo");
  });

  it("rezagado: la mitad o más de sus notas están sin firmar", () => {
    expect(estadoAdopcion(medico({ consultas: 10, sin_firmar: 5 }))).toBe("rezagado");
    expect(estadoAdopcion(medico({ consultas: 10, sin_firmar: 4 }))).toBe("activo");
  });

  it("sin actividad en el periodo, pero ya usó la herramienta antes", () => {
    expect(
      estadoAdopcion(medico({ consultas: 0, ultima: "2026-05-01T10:00:00Z" })),
    ).toBe("sin_uso");
  });

  it("nunca ha documentado: es la licencia que no se está usando", () => {
    expect(estadoAdopcion(medico({ consultas: 0, ultima: null }))).toBe("nunca");
  });
});

describe("etiquetas", () => {
  it("traduce estados y tipos conocidos", () => {
    expect(etiquetaEstado("borrador")).toBe("Borrador");
    expect(etiquetaTipo("telemedicina")).toBe("Telemedicina");
  });

  it("deja pasar un valor desconocido en vez de mostrar undefined", () => {
    expect(etiquetaEstado("valor_nuevo")).toBe("valor_nuevo");
    expect(etiquetaTipo("valor_nuevo")).toBe("valor_nuevo");
  });
});

describe("fetchHospitalDashboard", () => {
  const rango = { desde: "2026-07-10", hasta: "2026-08-08" };

  it("pasa el rango a la RPC y devuelve sus datos", async () => {
    const llamadas: unknown[] = [];
    const db = {
      rpc: (fn: string, args?: Record<string, unknown>) => {
        llamadas.push({ fn, args });
        return Promise.resolve({ data: { kpis: "ok" }, error: null });
      },
    };

    const res = await fetchHospitalDashboard(db, rango);
    expect(llamadas).toEqual([
      { fn: "hospital_dashboard", args: { p_from: "2026-07-10", p_to: "2026-08-08" } },
    ]);
    expect(res.error).toBeNull();
  });

  it("un fallo devuelve el dashboard vacío y NO lanza: el panel sigue en pie", async () => {
    const db = {
      rpc: () => Promise.resolve({ data: null, error: { message: "boom" } }),
    };

    const res = await fetchHospitalDashboard(db, rango);
    expect(res.data).toBe(DASHBOARD_VACIO);
    expect(res.error).toBe("boom");
  });

  it("una RPC que responde null se trata como error, no como cero notas", async () => {
    const db = { rpc: () => Promise.resolve({ data: null, error: null }) };

    const res = await fetchHospitalDashboard(db, rango);
    expect(res.data).toBe(DASHBOARD_VACIO);
    expect(res.error).toBeTruthy();
  });
});
