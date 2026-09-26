import { describe, it, expect } from "vitest";
import { MEDICATION_FIELDS, updateMedicationField } from "@/lib/clinical/discharge-edit";
import type { ClinicalMedicationPlanItem } from "@/lib/api/clinical";

const MEDS: ClinicalMedicationPlanItem[] = [
  {
    name: "Acetaminofén",
    dose: "500 mg",
    route: "VO",
    frequency: "cada 8 horas",
    duration: "3 días",
    instructions: "",
    evidence: "le doy acetaminofén",
  },
  { name: "Losartán", dose: "50 mg" },
];

describe("corregir el plan campo a campo", () => {
  it("corregir la dosis NO borra la vía (el bug del campo «Dosis y vía»)", () => {
    const r = updateMedicationField(MEDS, 0, "dose", "1 g");
    expect(r[0].dose).toBe("1 g");
    expect(r[0].route).toBe("VO");
    expect(r[0].evidence).toBe("le doy acetaminofén");
  });

  it("corregir la frecuencia NO borra la duración", () => {
    const r = updateMedicationField(MEDS, 0, "frequency", "cada 6 horas");
    expect(r[0].frequency).toBe("cada 6 horas");
    expect(r[0].duration).toBe("3 días");
  });

  it("concentración y cantidad son campos propios", () => {
    const r = updateMedicationField(updateMedicationField(MEDS, 0, "concentration", "500 mg/tableta"), 0, "quantity", "12 tabletas");
    expect(r[0].concentration).toBe("500 mg/tableta");
    expect(r[0].quantity).toBe("12 tabletas");
  });

  it("solo toca el medicamento pedido y no muta la lista original", () => {
    const r = updateMedicationField(MEDS, 1, "route", "oral");
    expect(r[0]).toBe(MEDS[0]);
    expect(r[1].route).toBe("oral");
    expect(MEDS[1].route).toBeUndefined();
  });

  it("un campo ajeno o un índice fuera de rango no cambian nada", () => {
    expect(updateMedicationField(MEDS, 0, "user_id" as never, "x")).toEqual(MEDS);
    expect(updateMedicationField(MEDS, 9, "dose", "x")).toEqual(MEDS);
  });

  it("el editor ofrece un campo por dato, sin campos juntados", () => {
    expect(MEDICATION_FIELDS.map((f) => f.field)).toEqual([
      "name", "concentration", "dose", "route", "frequency", "duration", "quantity", "instructions",
    ]);
  });
});
