import { describe, it, expect } from "vitest";
import {
  statusTone,
  acceptedCodes,
  suggestedCodes,
  ripsChecklist,
  ripsListo,
  completitud,
} from "@/lib/mock";
import type { ClinicalCode, Consultation } from "@/lib/mock";

// Fábricas mínimas: las funciones bajo prueba solo leen `estado`/`sistema` de los
// códigos y `codigos`/`estado` de la consulta, así que basta con esos campos.
function code(partial: Partial<ClinicalCode>): ClinicalCode {
  return { estado: "sugerido", sistema: "CIE-10", ...partial } as unknown as ClinicalCode;
}
function consulta(partial: Partial<Consultation>): Consultation {
  return { codigos: [], estado: "borrador", ...partial } as unknown as Consultation;
}

describe("statusTone", () => {
  it("mapea estados a tonos semánticos", () => {
    expect(statusTone("borrador")).toBe("neutral");
    expect(statusTone("revisada")).toBe("accent");
    expect(statusTone("aprobada")).toBe("success");
    expect(statusTone("exportada")).toBe("warning");
  });
});

describe("acceptedCodes / suggestedCodes", () => {
  const c = consulta({
    codigos: [
      code({ estado: "aceptado", sistema: "CIE-10" }),
      code({ estado: "aceptado", sistema: "CUPS" }),
      code({ estado: "sugerido", sistema: "CIE-10" }),
      code({ estado: "descartado", sistema: "CIE-10" }),
    ],
  });

  it("acceptedCodes filtra por estado aceptado", () => {
    expect(acceptedCodes(c)).toHaveLength(2);
  });
  it("acceptedCodes filtra además por sistema", () => {
    expect(acceptedCodes(c, "CIE-10")).toHaveLength(1);
    expect(acceptedCodes(c, "CUPS")).toHaveLength(1);
  });
  it("suggestedCodes solo devuelve los sugeridos", () => {
    expect(suggestedCodes(c)).toHaveLength(1);
  });
});

describe("ripsChecklist / completitud / ripsListo", () => {
  it("consulta vacía: 2/5 hechos (identificación + finalidad) = 40%", () => {
    const c = consulta({ codigos: [], estado: "borrador" });
    const hechos = ripsChecklist(c).filter((i) => i.done).length;
    expect(hechos).toBe(2);
    expect(completitud(c)).toBe(40);
    expect(ripsListo(c)).toBe(false);
  });

  it("con dx + procedimiento aceptados y nota aprobada = 100% y RIPS listo", () => {
    const c = consulta({
      estado: "aprobada",
      codigos: [
        code({ estado: "aceptado", sistema: "CIE-10" }),
        code({ estado: "aceptado", sistema: "CUPS" }),
      ],
    });
    expect(completitud(c)).toBe(100);
    expect(ripsListo(c)).toBe(true);
  });

  it("solo diagnóstico (sin procedimiento ni aprobación) = 60%", () => {
    const c = consulta({
      estado: "borrador",
      codigos: [code({ estado: "aceptado", sistema: "CIE-10" })],
    });
    expect(completitud(c)).toBe(60);
  });
});
