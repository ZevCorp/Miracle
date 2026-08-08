import { describe, it, expect } from "vitest";
import { SERVICIOS } from "@/lib/mock";
import {
  letterheadLines,
  ORG_SETTINGS_VACIOS,
  parseServicios,
  responsableLabelDe,
  rowToOrgSettings,
  servicioPorDefecto,
  serviciosDe,
  tieneEncabezado,
  type OrgSettings,
  type OrgSettingsRow,
} from "@/lib/hospital/org";

function org(parcial: Partial<OrgSettings> = {}): OrgSettings {
  return { ...ORG_SETTINGS_VACIOS, name: "Clínica del Norte", ...parcial };
}

function fila(parcial: Partial<OrgSettingsRow> = {}): OrgSettingsRow {
  return {
    name: "Clínica del Norte",
    nit: null,
    address: null,
    city: null,
    phone: null,
    servicios: null,
    default_responsable_label: null,
    use_hospital_templates: null,
    ...parcial,
  };
}

describe("rowToOrgSettings", () => {
  it("convierte cadenas en blanco a null para no imprimir líneas vacías", () => {
    const settings = rowToOrgSettings(fila({ nit: "   ", phone: "" }));
    expect(settings.nit).toBeNull();
    expect(settings.phone).toBeNull();
  });

  it("trata un array vacío de servicios como 'sin configurar'", () => {
    // Guardar cero servicios dejaría el selector de Consultas en blanco.
    expect(rowToOrgSettings(fila({ servicios: [] })).servicios).toBeNull();
  });

  it("sin fila devuelve los ajustes vacíos en vez de lanzar", () => {
    expect(rowToOrgSettings(null)).toEqual(ORG_SETTINGS_VACIOS);
  });

  it("use_hospital_templates en null se asume activo", () => {
    expect(rowToOrgSettings(fila()).useHospitalTemplates).toBe(true);
  });
});

describe("serviciosDe / servicioPorDefecto", () => {
  it("sin configurar usa la lista de la app: nada cambia para quien no entró a Configuración", () => {
    expect(serviciosDe(org())).toEqual([...SERVICIOS]);
    expect(servicioPorDefecto(org())).toBe("Consulta externa");
  });

  it("configurada, el primero es el servicio de las consultas nuevas", () => {
    const conServicios = org({ servicios: ["Dermatología", "Consulta prioritaria"] });
    expect(servicioPorDefecto(conServicios)).toBe("Dermatología");
  });
});

describe("letterheadLines", () => {
  it("omite las líneas sin dato", () => {
    expect(letterheadLines(org({ nit: "890900000-1" }))).toEqual(["NIT 890900000-1"]);
  });

  it("junta dirección y ciudad como un solo dato", () => {
    expect(
      letterheadLines(org({ address: "Calle 10 #40-20", city: "Medellín" })),
    ).toEqual(["Calle 10 #40-20 · Medellín"]);
  });

  it("respeta el orden de impresión: NIT, lugar, teléfono", () => {
    expect(
      letterheadLines(
        org({
          nit: "890900000-1",
          address: "Calle 10 #40-20",
          city: "Medellín",
          phone: "604 000 0000",
        }),
      ),
    ).toEqual(["NIT 890900000-1", "Calle 10 #40-20 · Medellín", "Tel. 604 000 0000"]);
  });

  it("una institución sin datos cargados no imprime encabezado de datos", () => {
    expect(letterheadLines(org())).toEqual([]);
    // Pero sí hay nombre, así que algo se imprime.
    expect(tieneEncabezado(org())).toBe(true);
    expect(tieneEncabezado(ORG_SETTINGS_VACIOS)).toBe(false);
  });
});

describe("responsableLabelDe", () => {
  it("el cargo del profesional manda sobre el de la institución", () => {
    expect(
      responsableLabelDe(org({ defaultResponsableLabel: "Médico tratante" }), "Jefe de Urgencias"),
    ).toBe("Jefe de Urgencias");
  });

  it("sin cargo en el perfil usa el de la institución", () => {
    expect(
      responsableLabelDe(org({ defaultResponsableLabel: "Médico tratante" }), null),
    ).toBe("Médico tratante");
  });

  it("un cargo en blanco en el perfil no gana al de la institución", () => {
    expect(
      responsableLabelDe(org({ defaultResponsableLabel: "Médico tratante" }), "   "),
    ).toBe("Médico tratante");
  });

  it("sin ninguno de los dos devuelve null y el bloque de firma no se imprime", () => {
    expect(responsableLabelDe(org(), null)).toBeNull();
  });
});

describe("parseServicios", () => {
  it("acepta coma y salto de línea, y recorta", () => {
    expect(parseServicios(" Urgencias , Hospitalización \n Consulta externa ")).toEqual([
      "Urgencias",
      "Hospitalización",
      "Consulta externa",
    ]);
  });

  it("descarta duplicados sin distinguir mayúsculas", () => {
    expect(parseServicios("Urgencias, urgencias, URGENCIAS")).toEqual(["Urgencias"]);
  });

  it("colapsa espacios internos", () => {
    expect(parseServicios("Consulta    externa")).toEqual(["Consulta externa"]);
  });

  it("una entrada vacía vuelve a 'sin configurar'", () => {
    expect(parseServicios("")).toBeNull();
    expect(parseServicios("  ,  , \n ")).toBeNull();
  });
});
