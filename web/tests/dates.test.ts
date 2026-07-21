import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { esDeHoy, formatFechaRelativa, formatHora } from "@/lib/dates";

// Se fija la fecha del sistema para probar "hoy" real y los bordes de día.
// 2026-07-21 14:30 hora local.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 6, 21, 14, 30, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

// Construye un ISO local (no UTC) para una fecha/hora dada del dispositivo.
function localIso(y: number, m: number, d: number, hh = 12, mm = 0): string {
  return new Date(y, m - 1, d, hh, mm, 0).toISOString();
}

describe("esDeHoy", () => {
  it("es verdadero para una fecha de hoy y falso para ayer/mañana", () => {
    expect(esDeHoy(localIso(2026, 7, 21, 8, 0))).toBe(true);
    expect(esDeHoy(localIso(2026, 7, 20, 23, 0))).toBe(false);
    expect(esDeHoy(localIso(2026, 7, 22, 1, 0))).toBe(false);
  });

  it("usa el día LOCAL, no el UTC (una hora nocturna de hoy sigue siendo hoy)", () => {
    // 23:30 local de hoy: en UTC (Bogotá -05) sería el día siguiente, pero el
    // día de calendario local es hoy.
    expect(esDeHoy(localIso(2026, 7, 21, 23, 30))).toBe(true);
  });
});

describe("formatFechaRelativa", () => {
  it("etiqueta hoy y ayer", () => {
    expect(formatFechaRelativa(localIso(2026, 7, 21, 14, 30))).toBe("Hoy · 14:30");
    expect(formatFechaRelativa(localIso(2026, 7, 20, 10, 20))).toBe("Ayer · 10:20");
  });

  it("usa dd/mm para fechas del mismo año", () => {
    expect(formatFechaRelativa(localIso(2026, 6, 18, 22, 38))).toBe("18/06 · 22:38");
  });

  it("añade el año cuando difiere del actual", () => {
    expect(formatFechaRelativa(localIso(2025, 6, 18, 22, 38))).toBe(
      "18/06/2025 · 22:38",
    );
  });
});

describe("formatHora", () => {
  it("formatea la hora en 24h", () => {
    expect(formatHora(localIso(2026, 7, 21, 9, 5))).toBe("09:05");
    expect(formatHora(localIso(2026, 7, 21, 18, 0))).toBe("18:00");
  });
});
