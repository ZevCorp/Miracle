import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { describe, expect, it } from "vitest";
import { findPrivacyMarkers, privacyMarkersInNote } from "@/lib/clinical/privacy-markers";
import { PrivacyShieldIcon } from "@/components/app/privacy-icon";

/**
 * Una nota con un marcador de privacidad sin resolver no se firma, y el
 * escudo con visto verde solo aparece cuando el servidor certificó la
 * protección. Ver lib/clinical/privacy-markers.ts y components/app/privacy-icon.tsx.
 */

const leer = (ruta: string) => readFileSync(fileURLToPath(new URL(ruta, import.meta.url)), "utf8");

describe("findPrivacyMarkers", () => {
  it("encuentra los marcadores de Graph, con y sin corchetes", () => {
    expect(findPrivacyMarkers("Paciente [PACIENTE_NOMBRE_1], CC [DOCUMENTO_1]. Tel TELEFONO_2.")).toEqual([
      "[PACIENTE_NOMBRE_1]",
      "[DOCUMENTO_1]",
      "TELEFONO_2",
    ]);
  });

  it("acepta las formas que abrevia o traduce el modelo, entre corchetes", () => {
    expect(findPrivacyMarkers("[PACIENTE_1] [Cédula 1] [tel_2] [PATIENT_NAME_3] [paciente nombre 1_2]")).toHaveLength(5);
  });

  it("no confunde la prosa ni los corchetes clínicos con un marcador", () => {
    expect(findPrivacyMarkers("el documento 1 dice que Documento_1 no aplica")).toEqual([]);
    expect(findPrivacyMarkers("Glasgow [15/15], TA 120/80 [sentado], [nota 1], [Anexo 2]")).toEqual([]);
  });
});

describe("privacyMarkersInNote", () => {
  it("revisa el texto, las listas de cada sección y el resumen", () => {
    const note = [
      { texto: "Nombre: [PACIENTE_NOMBRE_1]" },
      { items: ["Control en 8 días", "Llamar al [TELEFONO_1]"] },
      { texto: "Sin hallazgos." },
    ];
    expect(privacyMarkersInNote(note, "Consulta de [PACIENTE_NOMBRE_1] por cefalea.")).toEqual([
      "[PACIENTE_NOMBRE_1]",
      "[TELEFONO_1]",
      "[PACIENTE_NOMBRE_1]",
    ]);
    expect(privacyMarkersInNote([{ texto: "Nombre: Ana Torres" }], "Consulta por cefalea.")).toEqual([]);
    expect(privacyMarkersInNote(null, null)).toEqual([]);
  });
});

describe("firmar", () => {
  it("la firma en el servidor rechaza una nota con marcadores sin resolver", () => {
    const acciones = leer("../app/app/consultas/actions.ts");
    expect(acciones).toMatch(/privacyMarkersInNote\(/);
    // La comprobación va ANTES de escribir la firma.
    expect(acciones.indexOf("privacyMarkersInNote(")).toBeLessThan(acciones.indexOf('.update({ estado: "aprobada", firma })'));
  });
});

describe("el icono del escudo dice lo mismo que el texto", () => {
  it("visto verde solo con protección certificada", () => {
    expect(PrivacyShieldIcon({ tone: "success" }).type).toBe(ShieldCheck);
    expect(PrivacyShieldIcon({ tone: "warning" }).type).toBe(ShieldAlert);
    expect(PrivacyShieldIcon({ tone: "muted" }).type).toBe(Shield);
  });

  it("ninguna pantalla pinta el visto verde fijo junto a la privacidad", () => {
    for (const archivo of ["../components/app/EncounterAuditPanel.tsx", "../components/app/PrivacyShieldBadge.tsx"]) {
      expect(leer(archivo)).not.toMatch(/<ShieldCheck\b/);
    }
  });
});
