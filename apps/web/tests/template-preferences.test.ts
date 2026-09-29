import { describe, expect, it } from "vitest";
import type { ClinicalTemplate } from "@/lib/api/clinical";
import {
  isPinned,
  pickPreselectedTemplate,
  pinnedTemplateIds,
  rowToPreference,
  type TemplatePreference,
} from "@/lib/clinical/template-preferences";

function template(
  overrides: Partial<ClinicalTemplate> & { id: string },
): ClinicalTemplate {
  return {
    name: `Plantilla ${overrides.id}`,
    specialty: "medicina_general",
    scope: "institutional",
    status: "active",
    sections: [],
    ...overrides,
  };
}

function pref(
  templateId: string,
  specialtyCode = "medicina_general",
  updatedAt = "2026-08-11T10:00:00.000Z",
): TemplatePreference {
  return { templateId, specialtyCode, updatedAt };
}

/* ------------------------------------------------------------------ */
/* pickPreselectedTemplate                                             */
/* ------------------------------------------------------------------ */

describe("pickPreselectedTemplate", () => {
  const base = [
    template({ id: "default-general", is_default: true }),
    template({ id: "otra-general" }),
    template({ id: "default-pedia", specialty: "pediatria", is_default: true }),
    template({ id: "personal-1", scope: "personal" }),
  ];

  it("el pin del médico gana a la última usada y a la sugerida institucional", () => {
    expect(
      pickPreselectedTemplate({
        templates: base,
        preferences: [pref("otra-general")],
        lastUsedId: "default-pedia",
        specialtyCode: "medicina_general",
      }),
    ).toBe("otra-general");
  });

  it("un pin cuya plantilla ya no está activa cae al siguiente nivel (última usada)", () => {
    const conArchivada = [
      ...base,
      template({ id: "archivada", status: "archived" }),
    ];
    expect(
      pickPreselectedTemplate({
        templates: conArchivada,
        preferences: [pref("archivada")],
        lastUsedId: "otra-general",
        specialtyCode: "medicina_general",
      }),
    ).toBe("otra-general");
  });

  it("con varios pines gana el más reciente que siga activo", () => {
    expect(
      pickPreselectedTemplate({
        templates: base,
        preferences: [
          pref("otra-general", "medicina_general", "2026-08-01T00:00:00.000Z"),
          pref("default-pedia", "pediatria", "2026-08-10T00:00:00.000Z"),
        ],
        specialtyCode: "medicina_general",
      }),
    ).toBe("default-pedia");
  });

  it("el pin aplica aunque sea de otra especialidad: es decisión explícita del médico", () => {
    expect(
      pickPreselectedTemplate({
        templates: base,
        preferences: [pref("default-pedia", "pediatria")],
        specialtyCode: "medicina_general",
      }),
    ).toBe("default-pedia");
  });

  it("sin pin, la última usada gana a la sugerida institucional", () => {
    expect(
      pickPreselectedTemplate({
        templates: base,
        preferences: [],
        lastUsedId: "otra-general",
        specialtyCode: "medicina_general",
      }),
    ).toBe("otra-general");
  });

  it("sin pin ni última usada, preselecciona la sugerida de SU especialidad", () => {
    expect(
      pickPreselectedTemplate({
        templates: base,
        preferences: [],
        specialtyCode: "pediatria",
      }),
    ).toBe("default-pedia");
  });

  it("acepta el specialty_code en cualquier forma (guiones o guion_bajo)", () => {
    expect(
      pickPreselectedTemplate({
        templates: base,
        preferences: [],
        specialtyCode: "medicina-general",
      }),
    ).toBe("default-general");
  });

  it("sin sugerida en su especialidad, cae a personales primero", () => {
    const sinDefaults = [
      template({ id: "inst-1", specialty: "cardiologia" }),
      template({ id: "personal-1", scope: "personal" }),
    ];
    expect(
      pickPreselectedTemplate({
        templates: sinDefaults,
        preferences: [],
        specialtyCode: "dermatologia",
      }),
    ).toBe("personal-1");
  });

  it("sin plantillas devuelve cadena vacía", () => {
    expect(
      pickPreselectedTemplate({ templates: [], preferences: [] }),
    ).toBe("");
  });
});

/* ------------------------------------------------------------------ */
/* Helpers de pin y mapeo de filas                                     */
/* ------------------------------------------------------------------ */

describe("isPinned / pinnedTemplateIds", () => {
  it("marca exactamente los ids fijados", () => {
    const preferences = [pref("a"), pref("b", "pediatria")];
    expect(pinnedTemplateIds(preferences)).toEqual(new Set(["a", "b"]));
    expect(isPinned(preferences, { id: "a" })).toBe(true);
    expect(isPinned(preferences, { id: "c" })).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Modo elegido por el médico (Configuración > General)                */
/* ------------------------------------------------------------------ */

describe("pickPreselectedTemplate · modo de arranque", () => {
  const base = [
    template({ id: "default-general", is_default: true }),
    template({ id: "otra-general" }),
    template({ id: "personal-1", scope: "personal" }),
  ];

  it('sin `mode` se comporta como siempre: manda el pin', () => {
    // Es lo que protege a quien ya tenía un pin antes de que existiera la
    // pantalla de Configuración. Si el defecto fuera "last", a esa gente le
    // cambiaríamos la plantilla de arranque por debajo y sin avisar.
    expect(
      pickPreselectedTemplate({
        templates: base,
        preferences: [pref("otra-general")],
        lastUsedId: "personal-1",
      }),
    ).toBe("otra-general");
  });

  it('"manual" no preselecciona nada, ni siquiera habiendo pin y última usada', () => {
    expect(
      pickPreselectedTemplate({
        templates: base,
        preferences: [pref("otra-general")],
        lastUsedId: "personal-1",
        mode: "manual",
      }),
    ).toBe("");
  });

  it('"last" salta el pin y usa la última que de verdad se usó', () => {
    // Respetar el pin aquí sería ignorar lo que el médico pidió expresamente.
    expect(
      pickPreselectedTemplate({
        templates: base,
        preferences: [pref("otra-general")],
        lastUsedId: "personal-1",
        mode: "last",
      }),
    ).toBe("personal-1");
  });

  it('"last" sin memoria todavía cae a la sugerida institucional', () => {
    expect(
      pickPreselectedTemplate({
        templates: base,
        preferences: [pref("otra-general")],
        mode: "last",
        specialtyCode: "medicina_general",
      }),
    ).toBe("default-general");
  });

  it('"fixed" usa el pin y, si su plantilla ya no existe, no deja al médico sin nada', () => {
    expect(
      pickPreselectedTemplate({
        templates: base,
        preferences: [pref("borrada-hace-meses")],
        mode: "fixed",
        specialtyCode: "medicina_general",
      }),
    ).toBe("default-general");
  });
});

describe("rowToPreference", () => {
  it("mapea la fila snake_case de Supabase al modelo del frontend", () => {
    expect(
      rowToPreference({
        specialty_code: "medicina_interna",
        template_id: "c1000000-0000-4000-8000-000000000003",
        updated_at: "2026-08-11T12:00:00.000Z",
      }),
    ).toEqual({
      specialtyCode: "medicina_interna",
      templateId: "c1000000-0000-4000-8000-000000000003",
      updatedAt: "2026-08-11T12:00:00.000Z",
    });
  });
});
