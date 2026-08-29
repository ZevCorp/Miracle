import { describe, expect, it } from "vitest";
import { currentPhase, shouldAccumulate, IDLE_MS } from "@/lib/clinical/encounter-usage";

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

// La fase decide a qué etapa se le imputa cada tramo de tiempo. El orden de
// las guardas es lo que separa "cuánto dura la consulta" de "cuánto trabajo le
// queda al médico después de la IA", así que cada precedencia va fijada.

describe("currentPhase", () => {
  it("grabar manda sobre todo: dictar una corrección sigue siendo captura", () => {
    expect(currentPhase({ capturing: true, waiting: false, hasNote: true })).toBe("captura");
  });

  it("esperar al sistema manda sobre revisar", () => {
    expect(currentPhase({ capturing: false, waiting: true, hasNote: true })).toBe("generacion");
  });

  it("con nota y sin nada en curso, el tiempo es revisión", () => {
    expect(currentPhase({ capturing: false, waiting: false, hasNote: true })).toBe("revision");
  });

  it("sin nota todavía, el tiempo parado sigue siendo captura", () => {
    // Leer la transcripción antes de generar no es revisar la nota de la IA:
    // contarlo como revisión inflaría justo la cifra que debe bajar.
    expect(currentPhase({ capturing: false, waiting: false, hasNote: false })).toBe("captura");
  });

  it("las cuatro combinaciones caen siempre en una fase conocida", () => {
    const fases = new Set<string>();
    for (const capturing of [true, false]) {
      for (const waiting of [true, false]) {
        for (const hasNote of [true, false]) {
          fases.add(currentPhase({ capturing, waiting, hasNote }));
        }
      }
    }
    // Nunca 'otro': ese cajón es del servidor, para fases que no reconoce.
    expect([...fases].sort()).toEqual(["captura", "generacion", "revision"]);
  });
});
