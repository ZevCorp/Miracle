import { describe, expect, it } from "vitest";
import { clinicalSpecialties } from "@/lib/clinical/specialties";
import {
  getAreaForSpecialty,
  medicalAreas,
  medicalAreasWithSpecialties,
  specialtiesForArea,
  specialtyDisplayName,
} from "@/lib/clinical/medical-areas";
import {
  buildTemplatePayload,
  createBlock,
  MAX_TEMPLATE_SECTIONS,
  moveBlock,
  removeBlock,
  sectionKeyFromLabel,
  starterBlocksForSpecialty,
  templateToBlocks,
  templateToDraftBlocks,
  updateBlock,
  validateBlocks,
  type SectionBlock,
} from "@/lib/clinical/template-builder";
import type { ClinicalTemplate } from "@/lib/api/clinical";

/* ------------------------------------------------------------------ */
/* Áreas médicas                                                       */
/* ------------------------------------------------------------------ */

describe("agrupación por áreas médicas", () => {
  it("cubre exactamente las especialidades del catálogo sin repetir ninguna", () => {
    const codesEnAreas = medicalAreas.flatMap((area) => area.specialtyCodes);
    // Sin duplicados entre áreas.
    expect(new Set(codesEnAreas).size).toBe(codesEnAreas.length);
    // Cobertura total del catálogo.
    expect(codesEnAreas.length).toBe(clinicalSpecialties.length);
    // 49 clínicas/quirúrgicas/etc. + bacteriología (división de laboratorio).
    expect(clinicalSpecialties.length).toBe(50);
  });

  it("toda especialidad del catálogo pertenece a un área válida", () => {
    for (const specialty of clinicalSpecialties) {
      const area = getAreaForSpecialty(specialty.code);
      expect(area, `sin área: ${specialty.code}`).toBeTruthy();
      expect(area!.specialtyCodes).toContain(specialty.code);
    }
  });

  it("empareja especialidades sin importar guiones vs guion_bajo ni acentos", () => {
    expect(getAreaForSpecialty("medicina_general")?.code).toBe("medicina-clinica");
    expect(getAreaForSpecialty("medicina-general")?.code).toBe("medicina-clinica");
    expect(getAreaForSpecialty("ginecologia_obstetricia")?.code).toBe("materno-infantil");
  });

  it("specialtiesForArea devuelve la metadata completa en orden", () => {
    const mental = specialtiesForArea("salud-mental");
    expect(mental.map((s) => s.code)).toEqual(["psiquiatria", "psicologia"]);
    expect(mental[0].name).toBe("Psiquiatría");
  });

  it("specialtyDisplayName resuelve el nombre desde el code del backend", () => {
    expect(specialtyDisplayName("medicina_general")).toBe("Medicina general");
    expect(specialtyDisplayName("ginecologia_obstetricia")).toBe(
      "Ginecología y obstetricia",
    );
    // Code desconocido: degrada legible, no rompe.
    expect(specialtyDisplayName("algo_raro")).toBe("algo raro");
  });

  it("medicalAreasWithSpecialties no deja áreas vacías", () => {
    for (const { area, specialties } of medicalAreasWithSpecialties()) {
      expect(specialties.length, `área vacía: ${area.code}`).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Contadores institucional / personal (fuente: scope del backend)     */
/* ------------------------------------------------------------------ */

function template(partial: Partial<ClinicalTemplate>): ClinicalTemplate {
  return {
    id: partial.id ?? `id-${Math.random().toString(16).slice(2)}`,
    name: partial.name ?? "Plantilla",
    specialty: partial.specialty ?? "medicina_general",
    scope: partial.scope ?? "institutional",
    sections: partial.sections ?? [
      { key: "a", label: "A", order: 1 },
      { key: "b", label: "B", order: 2 },
    ],
    ...partial,
  };
}

describe("contadores por scope", () => {
  const catalog: ClinicalTemplate[] = [
    template({ scope: "institutional" }),
    template({ scope: "institutional" }),
    template({ scope: "institutional" }),
    template({ scope: "personal" }),
  ];

  it("cuenta institucionales y personales por scope, no por total de la tabla", () => {
    const institucionales = catalog.filter((t) => t.scope !== "personal").length;
    const personales = catalog.filter((t) => t.scope === "personal").length;
    expect(institucionales).toBe(3);
    // El bug histórico mostraba 147 (todas) como "Mías"; aquí debe ser 1.
    expect(personales).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* Constructor por bloques                                             */
/* ------------------------------------------------------------------ */

function blocks(labels: string[]): SectionBlock[] {
  return labels.map((label) => createBlock({ label }));
}

describe("operaciones sobre bloques", () => {
  it("agregar y quitar bloques", () => {
    let list = blocks(["Uno", "Dos"]);
    list = [...list, createBlock({ label: "Tres" })];
    expect(list).toHaveLength(3);
    const uidToRemove = list[1].uid;
    list = removeBlock(list, uidToRemove);
    expect(list.map((b) => b.label)).toEqual(["Uno", "Tres"]);
  });

  it("reordenar mueve el bloque a la nueva posición", () => {
    const list = blocks(["A", "B", "C"]);
    expect(moveBlock(list, 0, 2).map((b) => b.label)).toEqual(["B", "C", "A"]);
    expect(moveBlock(list, 2, 0).map((b) => b.label)).toEqual(["C", "A", "B"]);
    // Índices inválidos no mutan.
    expect(moveBlock(list, 0, 5)).toBe(list);
  });

  it("updateBlock cambia solo el bloque indicado", () => {
    const list = blocks(["A", "B"]);
    const next = updateBlock(list, list[0].uid, { required: true });
    expect(next[0].required).toBe(true);
    expect(next[1].required).toBe(false);
  });
});

describe("validación de bloques", () => {
  it("exige mínimo 2 secciones con nombre", () => {
    const result = validateBlocks(blocks(["Solo una", "  "]));
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/mínimo 2/);
  });

  it(`rechaza más de ${MAX_TEMPLATE_SECTIONS} secciones`, () => {
    const many = blocks(
      Array.from({ length: MAX_TEMPLATE_SECTIONS + 1 }, (_, i) => `Sección ${i}`),
    );
    expect(validateBlocks(many).ok).toBe(false);
  });

  it("detecta labels duplicados por su key efectiva", () => {
    // "Motivo de consulta" y "MOTIVO DE  CONSULTA" colapsan a la misma key.
    const result = validateBlocks(
      blocks(["Motivo de consulta", "MOTIVO DE  CONSULTA"]),
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/repetidos/);
    expect(result.duplicateUids.length).toBe(2);
  });

  it("acepta un conjunto válido", () => {
    expect(validateBlocks(blocks(["Motivo", "Plan"])).ok).toBe(true);
  });
});

describe("sectionKeyFromLabel", () => {
  it("genera snake_case sin acentos como el backend", () => {
    expect(sectionKeyFromLabel("Impresión Diagnóstica")).toBe("impresion_diagnostica");
    expect(sectionKeyFromLabel("  Plan y recomendaciones ")).toBe("plan_y_recomendaciones");
  });
});

describe("starterBlocksForSpecialty", () => {
  it("propone secciones iniciales sin keys duplicadas", () => {
    const starter = starterBlocksForSpecialty("medicina-general");
    expect(starter.length).toBeGreaterThanOrEqual(2);
    const keys = starter.map((b) => sectionKeyFromLabel(b.label));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

/* ------------------------------------------------------------------ */
/* Conversión plantilla ↔ bloques y payload                            */
/* ------------------------------------------------------------------ */

const baseTemplate: ClinicalTemplate = {
  id: "tpl-1",
  name: "Consulta inicial · Medicina general",
  specialty: "medicina_general",
  scope: "institutional",
  is_default: true,
  sections: [
    { key: "motivo_consulta", label: "Motivo de consulta", order: 1, required: true, instruction: "Resume el motivo." },
    { key: "plan", label: "Plan", order: 2, required: false, instruction: "Indica el plan." },
  ],
};

describe("templateToBlocks / templateToDraftBlocks", () => {
  it("editar conserva las keys de las secciones existentes", () => {
    const built = templateToBlocks(baseTemplate);
    expect(built.map((b) => b.key)).toEqual(["motivo_consulta", "plan"]);
    expect(built[0].required).toBe(true);
    expect(built[0].instruction).toBe("Resume el motivo.");
  });

  it("«usar como base» copia labels pero NO keys (plantilla nueva)", () => {
    const draft = templateToDraftBlocks(baseTemplate);
    expect(draft.map((b) => b.key)).toEqual([undefined, undefined]);
    expect(draft.map((b) => b.label)).toEqual(["Motivo de consulta", "Plan"]);
  });
});

describe("buildTemplatePayload", () => {
  it("arma el payload del contrato: order recalculado, required, sin vacíos", () => {
    const payload = buildTemplatePayload({
      name: "  Control de hipertensión  ",
      specialtyCode: "medicina_general",
      description: "  Seguimiento  ",
      blocks: [
        createBlock({ label: "Motivo del control", required: true, instruction: "Resume el motivo." }),
        createBlock({ label: "  ", required: false }), // vacío → se descarta
        createBlock({ label: "Adherencia", required: true }),
      ],
    });

    expect(payload.name).toBe("Control de hipertensión");
    expect(payload.specialty).toBe("medicina_general");
    expect(payload.description).toBe("Seguimiento");
    expect(payload.sections).toEqual([
      { label: "Motivo del control", order: 1, required: true, instruction: "Resume el motivo." },
      { label: "Adherencia", order: 2, required: true },
    ]);
  });

  it("preserva key al editar y omite instrucción vacía", () => {
    const editedBlocks = templateToBlocks(baseTemplate);
    // El médico renombra la primera sección pero es la MISMA (misma key).
    editedBlocks[0].label = "Motivo del control";
    editedBlocks[0].instruction = "";
    const payload = buildTemplatePayload({
      name: "Editada",
      specialtyCode: "medicina_general",
      blocks: editedBlocks,
    });
    expect(payload.sections[0]).toEqual({
      key: "motivo_consulta",
      label: "Motivo del control",
      order: 1,
      required: true,
    });
    // description undefined cuando no se pasa.
    expect(payload.description).toBeUndefined();
  });

  it("no incluye ningún campo que apunte a Supabase (solo contrato)", () => {
    const payload = buildTemplatePayload({
      name: "X",
      specialtyCode: "medicina_general",
      blocks: blocks(["A", "B"]),
    });
    const keys = Object.keys(payload);
    expect(keys.sort()).toEqual(["description", "name", "sections", "specialty"].sort());
    for (const section of payload.sections) {
      const sectionKeys = Object.keys(section as object);
      for (const k of sectionKeys) {
        expect(["key", "label", "order", "required", "instruction"]).toContain(k);
      }
    }
  });
});
