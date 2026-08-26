import { describe, expect, it } from "vitest";
import { shouldAccumulate, IDLE_MS } from "@/lib/clinical/encounter-usage";

// Las tres reglas del reloj de uso. Cada una existe por una métrica engañosa
// concreta: pestañas abandonadas que suman horas, o consultas grabando en
// segundo plano que no suman nada.

describe("shouldAccumulate", () => {
  it("grabando cuenta SIEMPRE, incluso con la pestaña oculta", () => {
    expect(
      shouldAccumulate({
        capturing: true,
        waiting: false,
        visible: false,
        msSinceInteraction: 10 * 60_000,
      }),
    ).toBe(true);
  });

  it("esperando al sistema cuenta solo si la pestaña es visible", () => {
    const base = { capturing: false, waiting: true, msSinceInteraction: 5 * 60_000 };
    expect(shouldAccumulate({ ...base, visible: true })).toBe(true);
    expect(shouldAccumulate({ ...base, visible: false })).toBe(false);
  });

  it("revisando cuenta con interacción reciente y deja de contar al pasar el idle", () => {
    const base = { capturing: false, waiting: false, visible: true };
    expect(shouldAccumulate({ ...base, msSinceInteraction: 30_000 })).toBe(true);
    expect(shouldAccumulate({ ...base, msSinceInteraction: IDLE_MS })).toBe(true);
    expect(shouldAccumulate({ ...base, msSinceInteraction: IDLE_MS + 1 })).toBe(false);
  });

  it("pestaña oculta sin grabar nunca cuenta, haya o no interacción previa", () => {
    expect(
      shouldAccumulate({
        capturing: false,
        waiting: false,
        visible: false,
        msSinceInteraction: 0,
      }),
    ).toBe(false);
  });
});
