import { describe, it, expect } from "vitest";
import {
  cantidadEnNumerosYLetras,
  construirDocumento,
  fechaLarga,
  numeroEnLetras,
  type DocumentoInput,
} from "@/lib/pdf/patient-documents";
import { documentoHtml } from "@/lib/pdf/patient-documents-html";

const BASE: DocumentoInput = {
  tipo: "formula",
  fecha: "2026-09-26T14:05",
  org: { name: "Consultorio Dra. Pérez", nit: "900.123.456-7", address: "Cra 43A # 1-50", city: "Medellín", phone: "604 444 0000" },
  medico: { nombre: "Ana Pérez", documento: "43123456", registro: "RM-4471", especialidad: "Medicina general" },
  paciente: { nombre: "María Gómez", documento: "CC 1035421987", edad: 34, sexo: "F", eps: "Sura" },
  nota: {
    summary: "Cefalea tensional.",
    sections: [{ label: "Motivo", content: "Dolor de cabeza" }, { label: "Vacía", content: "  " }],
    discharge: {
      plan: {
        medications: [
          { name: "Acetaminofén", concentration: "500 mg/tableta", dose: "1 tableta", route: "oral", frequency: "cada 8 horas", duration: "5 días", quantity: "15 tabletas", instructions: "después de comer" },
          { name: "Ibuprofeno", dose: "400 mg" },
          { name: "  " },
        ],
        non_pharmacological: [{ text: "Reposo relativo" }],
        follow_up: [{ text: "Control en 8 días" }],
      },
      recommendations: [{ text: "Hidratación abundante" }],
      alarm_signs: [
        { text: "Pérdida de fuerza", urgency: "emergency" },
        { text: "Fiebre", urgency: "priority" },
        { text: "Dolor que no cede" },
      ],
    },
  },
};

describe("la fórmula médica", () => {
  it("un bloque por medicamento con nombre, y lo que falta queda en blanco, nunca inventado", () => {
    const doc = construirDocumento(BASE);
    const meds = doc.bloques.filter((b) => b.tipo === "medicamento");
    expect(meds.map((m) => m.nombre)).toEqual(["Acetaminofén", "Ibuprofeno"]);
    const ibu = Object.fromEntries(meds[1].campos.map((c) => [c.etiqueta, c.valor]));
    expect(ibu["Dosis"]).toBe("400 mg");
    expect(ibu["Concentración y forma"]).toBe("");
    expect(ibu["Cantidad total"]).toBe("");
  });

  it("la cantidad va en números y letras", () => {
    const doc = construirDocumento(BASE);
    const ace = doc.bloques.find((b) => b.nombre === "Acetaminofén")!;
    expect(ace.campos.find((c) => c.etiqueta === "Cantidad total")!.valor).toBe("15 tabletas (quince)");
  });

  it("sin medicamentos lo dice, en vez de imprimir una fórmula vacía", () => {
    const doc = construirDocumento({ ...BASE, nota: { discharge: null } });
    expect(doc.bloques).toHaveLength(1);
    expect(doc.bloques[0].tipo).toBe("aviso");
  });
});

describe("los datos del documento", () => {
  it("lo que falta se omite: ni «undefined» ni «null» en ningún sitio", () => {
    const doc = construirDocumento({ tipo: "nota", fecha: "", org: {}, medico: {}, paciente: {}, nota: {} });
    const json = JSON.stringify(doc);
    expect(json).not.toMatch(/undefined|null|NaN/);
    expect(doc.datos).toEqual([{ etiqueta: "Paciente", valor: "Paciente sin identificar" }]);
    expect(doc.membrete).toEqual({ nombre: "", lineas: [] });
    expect(doc.sello).toEqual([]);
  });

  it("paciente con EPS, edad y sexo, y la fecha larga en español", () => {
    const doc = construirDocumento(BASE);
    const d = Object.fromEntries(doc.datos.map((x) => [x.etiqueta, x.valor]));
    expect(d["Edad y sexo"]).toBe("34 años · Femenino");
    expect(d["EPS"]).toBe("Sura");
    expect(d["Fecha"]).toBe("26 de septiembre de 2026, 2:05 p. m.");
    expect(doc.firma.lineas).toEqual(["Medicina general", "CC 43123456", "Registro médico RM-4471"]);
  });

  it("el sello del hospital solo con los cuatro datos personales, y solo en la nota", () => {
    const conSello = { ...BASE, tipo: "nota" as const, medico: { ...BASE.medico, honorifico: "Dra", responsable: "MÉDICO GENERAL" } };
    expect(construirDocumento(conSello).sello[0]).toBe(
      "Nota realizada por: Dra. Ana Pérez Empresa: Consultorio Dra. Pérez Fecha y hora: 26/09/2026, 02:05 p. m.",
    );
    expect(construirDocumento({ ...conSello, tipo: "formula" }).sello).toEqual([]);
    expect(construirDocumento({ ...BASE, tipo: "nota" }).sello).toEqual([]);
  });
});

describe("las indicaciones para el paciente", () => {
  it("los signos de alarma se agrupan por urgencia, de la más grave a la menos", () => {
    const doc = construirDocumento({ ...BASE, tipo: "indicaciones" });
    const alarmas = doc.bloques.filter((b) => b.tipo === "alarma");
    expect(alarmas.map((a) => a.nivel)).toEqual(["emergency", "priority", ""]);
    expect(alarmas[0].items).toEqual(["Pérdida de fuerza"]);
  });
});

describe("la nota clínica", () => {
  it("lleva el plan y el egreso, y no pinta secciones vacías", () => {
    const doc = construirDocumento({ ...BASE, tipo: "nota" });
    const titulos = doc.bloques.map((b) => b.titulo);
    expect(titulos).toContain("Plan farmacológico");
    expect(titulos).toContain("Signos de alarma");
    expect(titulos).not.toContain("Vacía");
  });
});

describe("números y fechas", () => {
  it("números en letras", () => {
    expect([0, 1, 15, 16, 21, 30, 45, 100, 101, 120, 500, 999, 1000, 1001, 2500, 21000].map(numeroEnLetras)).toEqual([
      "cero", "uno", "quince", "dieciséis", "veintiuno", "treinta", "cuarenta y cinco", "cien", "ciento uno",
      "ciento veinte", "quinientos", "novecientos noventa y nueve", "mil", "mil uno", "dos mil quinientos", "veintiuno mil",
    ]);
    expect(cantidadEnNumerosYLetras("una caja")).toBe("una caja");
    expect(cantidadEnNumerosYLetras("")).toBe("");
  });

  it("fechas inválidas no imprimen basura", () => {
    expect(fechaLarga("mañana")).toBe("");
    expect(fechaLarga("2026-13-01T10:00")).toBe("");
    expect(fechaLarga("2026-01-05T00:15")).toBe("5 de enero de 2026, 12:15 a. m.");
  });
});

describe("el HTML", () => {
  it("escapa lo escrito por el médico y deja espacio para escribir a mano", () => {
    const doc = construirDocumento({
      ...BASE,
      paciente: { ...BASE.paciente, nombre: "<script>x</script>" },
    });
    const html = documentoHtml(doc);
    expect(html).not.toContain("<script>x");
    expect(html).toContain('class="blank"');
    expect(html).toContain("counter(page)");
  });

  it("un nombre con «</style>» no se sale de la hoja de estilos (va también en el margen de página)", () => {
    const doc = construirDocumento({
      ...BASE,
      paciente: { ...BASE.paciente, nombre: "Ana</style><img src=x onerror=alert(1)>" },
    });
    const html = documentoHtml(doc);
    const estilos = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
    expect(estilos).not.toContain("<img");
    expect(html.match(/<\/style>/g)).toHaveLength(1);
    expect(html).not.toContain("<img src=x");
  });
});
