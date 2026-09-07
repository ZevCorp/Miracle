import { describe, expect, it } from "vitest";
import { buildDoctorContext } from "@/lib/preferences/assistant";
import { buildNoteGenerationContext } from "@/lib/preferences/note";
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
        note_detail: "detallada",
        assistant_address: "tu",
        assistant_detail: "breve",
        assistant_use_name: false,
      }),
    ).toEqual({
      templateStartMode: "manual",
      defaultServicio: "Urgencias",
      noteDetail: "detallada",
      assistantAddress: "tu",
      assistantDetail: "breve",
      assistantUseName: false,
    });
  });

  it("un valor que no reconoce cae al por defecto en vez de propagarse", () => {
    // Los CHECK de la tabla ya acotan esto, pero un valor raro NUNCA debe
    // llegar al prompt del asistente ni tumbar la pantalla.
    const salida = rowToPreferences({
      template_start_mode: "loquesea",
      default_servicio: "   ",
      note_detail: "gigante",
      assistant_address: "vos",
      assistant_detail: "",
      assistant_use_name: null,
    });
    expect(salida.templateStartMode).toBe("last");
    expect(salida.noteDetail).toBe("estandar");
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

describe("buildNoteGenerationContext", () => {
  it('con "estandar" no devuelve nada: la petición debe salir sin cuerpo, como siempre', () => {
    // Una preferencia igual al valor de fábrica no es una instrucción: mandarla
    // solo añadiría al prompt una línea que repite lo que ya dice.
    expect(buildNoteGenerationContext(prefs())).toBeUndefined();
  });

  it("manda la extensión bajo note_detail cuando el médico eligió otra", () => {
    expect(buildNoteGenerationContext(prefs({ noteDetail: "concisa" }))).toEqual({
      note_detail: "concisa",
    });
    expect(buildNoteGenerationContext(prefs({ noteDetail: "detallada" }))).toEqual({
      note_detail: "detallada",
    });
  });

  it("no manda nombre ni trato: al generador solo le importa la extensión", () => {
    const salida = buildNoteGenerationContext(
      prefs({ noteDetail: "concisa", assistantAddress: "tu", assistantUseName: true }),
    );
    expect(Object.keys(salida ?? {})).toEqual(["note_detail"]);
  });
});
