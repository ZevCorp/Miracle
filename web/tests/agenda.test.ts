import { describe, expect, it } from "vitest";
import {
  appointmentImportFingerprint,
  normalizeHora,
  rowToAppointment,
} from "@/lib/agenda";

describe("agenda importada desde captura", () => {
  it("normaliza horas válidas y rechaza horas ambiguas o imposibles", () => {
    expect(normalizeHora("8:05")).toBe("08:05");
    expect(normalizeHora("08.30")).toBe("08:30");
    expect(normalizeHora("08:30:00")).toBe("08:30");
    expect(normalizeHora("24:00")).toBeNull();
    expect(normalizeHora("08:60")).toBeNull();
    expect(normalizeHora("por la mañana")).toBeNull();
  });

  it("crea la misma huella para la misma cita aunque la captura varíe en espacios y formato de hora", async () => {
    const first = await appointmentImportFingerprint({
      fecha: "2026-07-15",
      hora: "8:30",
      paciente: "  Ana   Pérez ",
    });
    const duplicate = await appointmentImportFingerprint({
      fecha: "2026-07-15",
      hora: "08.30",
      paciente: "ana pérez",
    });
    const differentTime = await appointmentImportFingerprint({
      fecha: "2026-07-15",
      hora: "09:30",
      paciente: "Ana Pérez",
    });

    expect(first).toHaveLength(64);
    expect(duplicate).toBe(first);
    expect(differentTime).not.toBe(first);
  });

  it("preserva el vínculo de una cita con su consulta clínica", () => {
    expect(
      rowToAppointment({
        id: "appointment-1",
        paciente_nombre: "Ana Pérez",
        fecha: "2026-07-15",
        hora: "08:30:00",
        estado: "en_curso",
        source: "importada",
        clinical_encounter_id: "encounter-1",
      }),
    ).toMatchObject({
      hora: "08:30",
      estado: "en_curso",
      source: "importada",
      clinicalEncounterId: "encounter-1",
    });
  });
});
