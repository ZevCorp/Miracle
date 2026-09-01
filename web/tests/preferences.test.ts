import { describe, expect, it } from "vitest";
import { buildDoctorContext } from "@/lib/preferences/assistant";
import {
  PREFERENCIAS_POR_DEFECTO,
  nombreDePila,
  rowToPreferences,
  type UserPreferences,
} from "@/lib/preferences/types";

function prefs(parcial: Partial<UserPreferences> = {}): UserPreferences {
  return { ...PREFERENCIAS_POR_DEFECTO, ...parcial };
}

describe("rowToPreferences", () => {
  it("sin fila devuelve los valores por defecto (usuario que nunca entró a Configuración)", () => {
    expect(rowToPreferences(null)).toEqual(PREFERENCIAS_POR_DEFECTO);
  });

  it("mapea la fila snake_case al modelo del frontend", () => {
    expect(
      rowToPreferences({
        template_start_mode: "manual",
        default_servicio: "Urgencias",
        assistant_address: "tu",
        assistant_detail: "breve",
        assistant_use_name: false,
      }),
    ).toEqual({
      templateStartMode: "manual",
      defaultServicio: "Urgencias",
      assistantAddress: "tu",
      assistantDetail: "breve",
      assistantUseName: false,
      noteDetail: "equilibrado",
    });
  });

  it("note_detail se mapea y cae a equilibrado ante un valor raro o una fila vieja", () => {
    const base = {
      template_start_mode: "last",
      default_servicio: null,
      assistant_address: "usted",
      assistant_detail: "equilibrado",
      assistant_use_name: true,
    };
    expect(rowToPreferences({ ...base, note_detail: "conciso" }).noteDetail).toBe("conciso");
    expect(rowToPreferences({ ...base, note_detail: "detallado" }).noteDetail).toBe("detallado");
    expect(rowToPreferences({ ...base, note_detail: "larguísimo" }).noteDetail).toBe("equilibrado");
    // Fila anterior a la columna: el campo no viene.
    expect(rowToPreferences(base).noteDetail).toBe("equilibrado");
  });

  it("un valor que no reconoce cae al por defecto en vez de propagarse", () => {
    // Los CHECK de la tabla ya acotan esto, pero un valor raro NUNCA debe
    // llegar al prompt del asistente ni tumbar la pantalla.
    const salida = rowToPreferences({
      template_start_mode: "loquesea",
      default_servicio: "   ",
      assistant_address: "vos",
      assistant_detail: "",
      assistant_use_name: null,
    });
    expect(salida.templateStartMode).toBe("last");
    expect(salida.assistantAddress).toBe("usted");
    expect(salida.assistantDetail).toBe("equilibrado");
    expect(salida.assistantUseName).toBe(true);
    expect(salida.defaultServicio).toBeNull();
  });
});

describe("nombreDePila", () => {
  it("se queda con el primer nombre", () => {
    expect(nombreDePila("Juan Camilo Restrepo Vélez")).toBe("Juan");
  });

  it("salta el honorífico: las cuentas suelen venir cargadas como «Dr. Pérez»", () => {
    expect(nombreDePila("Dr. Andrés Gómez")).toBe("Andrés");
    expect(nombreDePila("Dra Lucía Mesa")).toBe("Lucía");
  });

  it("sin nombre cargado devuelve null", () => {
    expect(nombreDePila(null)).toBeNull();
    expect(nombreDePila("   ")).toBeNull();
    expect(nombreDePila("Dr.")).toBeNull();
  });
});

describe("buildDoctorContext", () => {
  it("no manda el nombre si el médico apagó esa preferencia", () => {
    const salida = buildDoctorContext(prefs({ assistantUseName: false }), "Juan");
    expect(salida?.display_name).toBeUndefined();
  });

  it("no manda el nombre si no hay nombre cargado", () => {
    expect(buildDoctorContext(prefs(), null)?.display_name).toBeUndefined();
  });

  it('no manda "equilibrado": es el comportamiento por defecto del prompt', () => {
    // Enviarlo solo añadiría al system prompt una línea que repite lo que ya
    // dice. Una preferencia igual al valor de fábrica no es una instrucción.
    expect(buildDoctorContext(prefs(), null)?.detail).toBeUndefined();
    expect(buildDoctorContext(prefs({ assistantDetail: "breve" }), null)?.detail).toBe(
      "breve",
    );
  });

  it("arma el bloque completo cuando hay algo que decir", () => {
    expect(
      buildDoctorContext(
        prefs({ assistantAddress: "tu", assistantDetail: "detallado" }),
        "Juan",
      ),
    ).toEqual({ display_name: "Juan", address: "tu", detail: "detallado" });
  });
});
