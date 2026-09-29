import { describe, expect, it } from "vitest";
import {
  documentoKey,
  draftFromPatient,
  emptyPatientDraft,
  findDuplicates,
  formatDocumento,
  nombreKey,
  payloadFromDraft,
  validatePatientDraft,
  type PatientDraft,
} from "@/lib/clinical/patient-form";
import type { Patient } from "@/lib/mock/types";

function paciente(over: Partial<Patient> = {}): Patient {
  return {
    id: "p1",
    nombre: "María Fernanda Restrepo",
    documento: "CC 1023456789",
    edad: 34,
    sexo: "F",
    eps: "Sura",
    telefono: "3001234567",
    antecedentes: [],
    alergias: [],
    medicamentos: [],
    ...over,
  };
}

function borrador(over: Partial<PatientDraft> = {}): PatientDraft {
  return { ...emptyPatientDraft(), nombre: "Juan Gómez", ...over };
}

describe("formatDocumento", () => {
  it("escribe el documento en una sola forma, sin separadores", () => {
    expect(formatDocumento("CC", "1.023.456.789")).toBe("CC 1023456789");
    expect(formatDocumento("CC", "1 023 456 789")).toBe("CC 1023456789");
    // El dictado los parte como si fueran un teléfono; no se guarda así.
    expect(formatDocumento("CC", "23-45-67-75-43")).toBe("CC 2345677543");
  });

  it("sin tipo deja solo el número, y sin número no hay documento", () => {
    expect(formatDocumento("", "1023456789")).toBe("1023456789");
    expect(formatDocumento("CC", "   ")).toBeNull();
  });
});

describe("documentoKey", () => {
  it("iguala el mismo documento escrito de formas distintas", () => {
    const esperado = "1023456789";
    expect(documentoKey("CC 1023456789")).toBe(esperado);
    expect(documentoKey("1.023.456.789")).toBe(esperado);
    expect(documentoKey("cédula de ciudadanía 1023456789")).toBe(esperado);
  });

  it("no confunde un pasaporte con su parte numérica", () => {
    expect(documentoKey("PA AY123456")).toBe("AY123456");
    expect(documentoKey("PA AY123456")).not.toBe("123456");
  });

  it("los placeholders no son documentos", () => {
    expect(documentoKey("Por registrar")).toBeNull();
    expect(documentoKey("—")).toBeNull();
    expect(documentoKey("")).toBeNull();
    expect(documentoKey(null)).toBeNull();
  });
});

describe("nombreKey", () => {
  it("ignora tildes, mayúsculas y espacios de más", () => {
    expect(nombreKey("  José   Peña ")).toBe(nombreKey("jose pena"));
  });
});

describe("draftFromPatient", () => {
  it("parte el documento guardado en tipo y número", () => {
    const draft = draftFromPatient(paciente());
    expect(draft.documentoTipo).toBe("CC");
    expect(draft.documentoNumero).toBe("1023456789");
  });

  it("editar y guardar sin tocar nada no cambia el documento", () => {
    const original = paciente({ documento: "PA AY123456" });
    const vuelta = payloadFromDraft(draftFromPatient(original));
    expect(vuelta.documento).toBe("PA AY123456");
  });

  it("los placeholders del store vuelven a ser campos vacíos", () => {
    const draft = draftFromPatient(
      paciente({ documento: "Por registrar", eps: "Por registrar", telefono: "—", edad: 0 }),
    );
    expect(draft.documentoNumero).toBe("");
    expect(draft.eps).toBe("");
    expect(draft.telefono).toBe("");
    // Edad sin registrar no es "0": es un campo en blanco.
    expect(draft.edad).toBe("");
  });

  it("un tipo fuera del catálogo no se inventa", () => {
    const draft = draftFromPatient(paciente({ documento: "NIT 900123456" }));
    expect(draft.documentoTipo).toBe("");
  });
});

describe("validatePatientDraft", () => {
  it("solo el nombre es obligatorio", () => {
    expect(validatePatientDraft(borrador())).toBeNull();
    expect(validatePatientDraft(borrador({ nombre: " J " }))).not.toBeNull();
  });

  it("rechaza edades imposibles y documentos sin cifras", () => {
    expect(validatePatientDraft(borrador({ edad: "999" }))).not.toBeNull();
    expect(validatePatientDraft(borrador({ edad: "0" }))).toBeNull();
    expect(validatePatientDraft(borrador({ documentoNumero: "abc" }))).not.toBeNull();
  });
});

describe("payloadFromDraft", () => {
  it("un campo vacío se guarda como ausente, no como cero ni cadena vacía", () => {
    const payload = payloadFromDraft(borrador());
    expect(payload.documento).toBeNull();
    expect(payload.edad).toBeNull();
    expect(payload.sexo).toBeNull();
    expect(payload.eps).toBeNull();
    expect(payload.telefono).toBeNull();
  });

  it("limpia las listas de historia clínica", () => {
    const payload = payloadFromDraft(
      borrador({ alergias: [" Penicilina ", "", "  "], antecedentes: ["HTA"] }),
    );
    expect(payload.alergias).toEqual(["Penicilina"]);
    expect(payload.antecedentes).toEqual(["HTA"]);
  });
});

describe("findDuplicates", () => {
  const registrados = [
    paciente({ id: "a", nombre: "María Fernanda Restrepo", documento: "CC 1023456789" }),
    paciente({ id: "b", nombre: "Juan Carlos Gómez", documento: "CC 71234567" }),
  ];

  it("detecta el mismo documento aunque esté escrito distinto", () => {
    const encontrados = findDuplicates(
      registrados,
      borrador({ nombre: "M. F. Restrepo", documentoNumero: "1.023.456.789" }),
    );
    expect(encontrados).toHaveLength(1);
    expect(encontrados[0].patient.id).toBe("a");
    expect(encontrados[0].reason).toBe("documento");
  });

  it("el nombre repetido es indicio, no identidad", () => {
    const encontrados = findDuplicates(
      registrados,
      borrador({ nombre: "juan carlos gomez", documentoNumero: "" }),
    );
    expect(encontrados).toHaveLength(1);
    expect(encontrados[0].reason).toBe("nombre");
  });

  it("editar una ficha no la reporta como duplicada de sí misma", () => {
    const draft = draftFromPatient(registrados[0]);
    expect(findDuplicates(registrados, draft, "a")).toHaveLength(0);
  });

  it("un nombre nuevo con documento nuevo no dispara nada", () => {
    expect(
      findDuplicates(registrados, borrador({ nombre: "Ana Lucía Pérez", documentoNumero: "52987654" })),
    ).toHaveLength(0);
  });
});
