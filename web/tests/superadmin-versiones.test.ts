import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  estaDesactualizada,
  estadoDispositivo,
  versionEsAnterior,
  versionMasReciente,
} from "@/lib/superadmin/versiones";

describe("versionEsAnterior", () => {
  it("compara por segmentos numéricos, no como texto", () => {
    // El caso que un compare de textos falla: "1.9" > "1.10" alfabéticamente.
    expect(versionEsAnterior("1.9.0", "1.10.0")).toBe(true);
    expect(versionEsAnterior("1.10.0", "1.9.0")).toBe(false);
    // Y el caso real de la flota móvil.
    expect(versionEsAnterior("0.9", "0.40")).toBe(true);
  });

  it("trata las versiones con distinto número de segmentos", () => {
    expect(versionEsAnterior("1.0", "1.0.0.1")).toBe(true);
    expect(versionEsAnterior("1.0.0.0", "1.0")).toBe(false);
  });

  it("ignora la v inicial y los espacios", () => {
    expect(versionEsAnterior("v1.0.0", "1.0.1")).toBe(true);
    expect(versionEsAnterior(" 1.0.0 ", "1.0.0")).toBe(false);
  });

  it("una pre-release es anterior a su release", () => {
    // Regresión: la implementación anterior mapeaba "0-beta" a 0 y las daba
    // por iguales, así que una beta nunca se marcaba como desactualizada.
    expect(versionEsAnterior("1.2.0-beta.3", "1.2.0")).toBe(true);
    expect(versionEsAnterior("1.2.0", "1.2.0-beta.3")).toBe(false);
    expect(versionEsAnterior("0.0.0-local", "0.0.0")).toBe(true);
  });

  it("una versión no es anterior a sí misma", () => {
    expect(versionEsAnterior("1.0.0.0", "1.0.0.0")).toBe(false);
    expect(versionEsAnterior("1.0.0-beta", "1.0.0-beta")).toBe(false);
  });
});

describe("versionMasReciente", () => {
  it("elige la mayor e ignora nulos", () => {
    expect(versionMasReciente(["0.1", "0.40", null, undefined, "0.9"])).toBe("0.40");
    expect(versionMasReciente(["1.0.0.0", "0.0.0-local"])).toBe("1.0.0.0");
  });

  it("devuelve null si no hay ninguna versión", () => {
    expect(versionMasReciente([])).toBeNull();
    expect(versionMasReciente([null, undefined])).toBeNull();
  });
});

describe("estaDesactualizada", () => {
  it("marca solo lo que está por debajo de la más reciente", () => {
    expect(estaDesactualizada("0.1", "0.40")).toBe(true);
    expect(estaDesactualizada("0.40", "0.40")).toBe(false);
  });

  it("no marca nada si falta algún dato", () => {
    expect(estaDesactualizada(null, "1.0")).toBe(false);
    expect(estaDesactualizada("1.0", null)).toBe(false);
  });
});

describe("estadoDispositivo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T19:00:00Z")); // 14:00 en Bogotá
  });
  afterEach(() => vi.useRealTimers());

  // Se inyecta esDeHoy para no acoplar la prueba a la zona horaria: aquí se
  // simula que "hoy" es el 3 de agosto en Bogotá.
  const esDeHoy = (iso: string) => iso.startsWith("2026-08-03") || iso === "2026-08-04T02:00:00Z";

  it("en línea si se vio hace menos de 15 minutos", () => {
    expect(estadoDispositivo("2026-08-03T18:55:00Z", esDeHoy)).toBe("en_linea");
  });

  it("hoy si es del mismo día pero hace rato", () => {
    expect(estadoDispositivo("2026-08-03T12:00:00Z", esDeHoy)).toBe("hoy");
  });

  it("reciente dentro de la semana", () => {
    expect(estadoDispositivo("2026-07-30T12:00:00Z", esDeHoy)).toBe("reciente");
  });

  it("inactivo pasada la semana", () => {
    expect(estadoDispositivo("2026-07-01T12:00:00Z", esDeHoy)).toBe("inactivo");
  });

  it("nunca si no hay fecha", () => {
    expect(estadoDispositivo(null, esDeHoy)).toBe("nunca");
    expect(estadoDispositivo(undefined, esDeHoy)).toBe("nunca");
  });
});
