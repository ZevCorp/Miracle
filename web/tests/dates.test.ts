import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  claveDiaZona,
  esDeHoy,
  formatFechaHora,
  formatFechaHoraTabular,
  formatFechaRelativa,
  formatHora,
} from "@/lib/dates";

// Las pruebas anteriores construían los instantes con `new Date(y, m, d)` — es
// decir, en la zona de la máquina — y escribían las expectativas en esa misma
// zona, así que pasaban bajo CUALQUIER TZ y eran incapaces de detectar el bug
// que arregla esta versión. Aquí los instantes son UTC explícitos (sufijo Z) y
// las expectativas están en hora de Bogotá (UTC-5), que es lo que el usuario ve.
//
// vitest.config.ts fija TZ=UTC para que además reproduzcan el entorno de Vercel.

// 2026-07-21 19:30 UTC = 2026-07-21 14:30 en Bogotá.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-21T19:30:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("claveDiaZona", () => {
  it("da el día de Bogotá, no el de UTC", () => {
    // 03:30 UTC del 22 son las 22:30 del 21 en Bogotá.
    expect(claveDiaZona(new Date("2026-07-22T03:30:00Z"))).toBe("2026-07-21");
    // 05:00 UTC es justo la medianoche de Bogotá: ya es día nuevo.
    expect(claveDiaZona(new Date("2026-07-22T05:00:00Z"))).toBe("2026-07-22");
    expect(claveDiaZona(new Date("2026-07-22T04:59:59Z"))).toBe("2026-07-21");
  });
});

describe("esDeHoy", () => {
  it("es verdadero para una fecha de hoy y falso para ayer/mañana", () => {
    expect(esDeHoy("2026-07-21T13:00:00Z")).toBe(true); // 08:00 Bogotá
    expect(esDeHoy("2026-07-21T04:00:00Z")).toBe(false); // 23:00 del 20
    expect(esDeHoy("2026-07-22T06:00:00Z")).toBe(false); // 01:00 del 22
  });

  it("una hora nocturna de hoy sigue siendo hoy aunque en UTC ya sea mañana", () => {
    // Regresión: con la implementación anterior esto daba false, y por eso el
    // punto verde de las flotas se apagaba a las 19:00 hora de Bogotá.
    expect(esDeHoy("2026-07-22T03:30:00Z")).toBe(true); // 22:30 Bogotá del 21
  });
});

describe("formatHora", () => {
  it("formatea en 24 h sobre la zona clínica", () => {
    expect(formatHora("2026-07-21T14:05:00Z")).toBe("09:05");
    expect(formatHora("2026-07-21T23:00:00Z")).toBe("18:00");
  });

  it("imprime la medianoche como 00:xx y no como 24:xx", () => {
    // Regresión de `hour12: false`, que en varias builds de ICU da "24:05".
    expect(formatHora("2026-07-21T05:05:00Z")).toBe("00:05");
  });
});

describe("formatFechaRelativa", () => {
  it("etiqueta hoy y ayer", () => {
    expect(formatFechaRelativa("2026-07-21T19:30:00Z")).toBe("Hoy · 14:30");
    expect(formatFechaRelativa("2026-07-20T15:20:00Z")).toBe("Ayer · 10:20");
  });

  it("respeta la frontera de medianoche de Bogotá, no la de UTC", () => {
    // 04:59 UTC del 22 → 23:59 del 21 en Bogotá: todavía "Hoy".
    expect(formatFechaRelativa("2026-07-22T04:59:00Z")).toBe("Hoy · 23:59");
  });

  it("usa dd/mm para fechas del mismo año", () => {
    expect(formatFechaRelativa("2026-06-19T03:38:00Z")).toBe("18/06 · 22:38");
  });

  it("añade el año cuando difiere del actual", () => {
    expect(formatFechaRelativa("2025-06-19T03:38:00Z")).toBe("18/06/2025 · 22:38");
  });

  it("cuenta días de calendario, no bloques de 24 horas", () => {
    // Hace 20 horas, pero dos días de calendario distintos en Bogotá.
    vi.setSystemTime(new Date("2026-07-21T14:00:00Z")); // 09:00 Bogotá del 21
    expect(formatFechaRelativa("2026-07-20T23:00:00Z")).toBe("Ayer · 18:00");
  });
});

describe("formatFechaHora y formatFechaHoraTabular", () => {
  it("dan la fecha completa en la zona clínica", () => {
    expect(formatFechaHora("2026-07-22T03:30:00Z")).toBe("21/07/2026 · 22:30");
    expect(formatFechaHoraTabular("2026-07-22T03:30:00Z")).toBe("2026-07-21 22:30");
  });
});
