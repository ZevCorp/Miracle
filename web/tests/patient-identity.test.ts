import { describe, it, expect } from "vitest";
import { extractPatientIdentity } from "@/lib/clinical/patient-identity";

/** Secciones como las guarda el store local (`texto` + `titulo`). */
function seccion(id: string, titulo: string, texto: string) {
  return { key: id, titulo, texto };
}

/** Sección de identificación dictada: el caso de medicina general. */
function prosa(texto: string) {
  return [seccion("identificacion", "Identificación", texto)];
}

describe("secciones estructuradas (patología)", () => {
  const note = [
    seccion("rotulo", "Rótulo", "26-2931"),
    seccion("nombre_paciente", "Nombre del paciente", "Rafael Enrique Vanegas"),
    seccion("cedula", "Cédula", "8171924"),
  ];

  it("lee el nombre y la cédula tal cual", () => {
    expect(extractPatientIdentity(note)).toEqual({
      nombre: "Rafael Enrique Vanegas",
      documento: "8171924",
    });
  });

  it("quita la puntuación final que deja el dictado", () => {
    const conPunto = [seccion("nombre_paciente", "Nombre del paciente", "Malía Cristal Romero.")];
    expect(extractPatientIdentity(conPunto).nombre).toBe("Malía Cristal Romero");
  });

  it("lee también la forma del backend clínico (`content` + `label`)", () => {
    const backend = [
      { key: "nombre_paciente", label: "Nombre del paciente", content: "Ana Gómez" },
      { key: "cedula", label: "Cédula", content: "1040181619" },
    ];
    expect(extractPatientIdentity(backend)).toEqual({
      nombre: "Ana Gómez",
      documento: "1040181619",
    });
  });
});

describe("prosa dictada (medicina general)", () => {
  it.each([
    ["Paciente identificado como Felipe Maldonado.", "Felipe Maldonado"],
    ["El paciente se llama Cristian Felipe Maldonado.", "Cristian Felipe Maldonado"],
    ["Paciente femenina llamada Amalia García, 28 años.", "Amalia García"],
    ["La paciente refiere llamarse Camila Flores, con cédula 1089934418.", "Camila Flores"],
    ["Nombre de paciente Cristian Ortiz, 22 años.", "Cristian Ortiz"],
    ["Paciente masculino, nombre Pablo Maldonado, 27 años.", "Pablo Maldonado"],
  ])("saca el nombre de %j", (texto, esperado) => {
    expect(extractPatientIdentity(prosa(texto)).nombre).toBe(esperado);
  });

  it("no se traga la frase siguiente cuando el nombre termina en punto", () => {
    // "Edad" va en mayúscula: sin cortar en la puntuación, se colaría en el nombre.
    const r = extractPatientIdentity(prosa("Nombre: Andrés Montero. Edad: 22 años."));
    expect(r.nombre).toBe("Andrés Montero");
  });

  it("respeta las partículas de los apellidos compuestos", () => {
    const r = extractPatientIdentity(prosa("Paciente identificado como Nancy del Carmen Rojas Toro."));
    expect(r.nombre).toBe("Nancy del Carmen Rojas Toro");
  });
});

describe("lo dudoso no se devuelve", () => {
  it.each([
    "No referido.",
    "No mencionado en la consulta.",
    "El paciente menciona un nombre de forma fragmentaria sin confirmación.",
    "Paciente masculino de 39 años.",
  ])("deja el nombre vacío en %j", (texto) => {
    expect(extractPatientIdentity(prosa(texto)).nombre).toBeUndefined();
  });

  it("no confunde un relleno con un nombre propio", () => {
    // Sin lista de descarte esto devolvía un paciente llamado "No".
    expect(extractPatientIdentity(prosa("Nombre: No referido.")).nombre).toBeUndefined();
  });

  it("ignora la identificación del microorganismo (bacteriología)", () => {
    const note = [
      seccion("identificacion", "Identificación del microorganismo", "Se aísla Escherichia Coli."),
    ];
    expect(extractPatientIdentity(note).nombre).toBeUndefined();
  });

  it("ignora la verificación del rótulo contra la orden", () => {
    const note = [
      seccion("verificacion_de_identificacion", "Verificación de identificación", "Nombre Coincide Todo."),
    ];
    expect(extractPatientIdentity(note).nombre).toBeUndefined();
  });

  it("no devuelve nota vacía ni nula", () => {
    expect(extractPatientIdentity([])).toEqual({});
    expect(extractPatientIdentity(null)).toEqual({});
    expect(extractPatientIdentity(undefined)).toEqual({});
  });
});

describe("documento", () => {
  it("se queda solo con las cifras, sin importar cómo se agrupen al dictar", () => {
    const r = extractPatientIdentity(prosa("Nombre de paciente Cristian Ortiz, número de identificación 23-48-53."));
    expect(r.documento).toBe("234853");
  });

  it("obedece la corrección dictada en voz alta", () => {
    // Caso real: el médico rectifica después de decir el primer número.
    const r = extractPatientIdentity(
      prosa("Paciente de 18 años, número de documento 23-47-48. Repito: 47-48-53-92."),
    );
    expect(r.documento).toBe("47485392");
  });

  it("no toma un número suelto sin etiqueta que lo ancle", () => {
    const r = extractPatientIdentity(prosa("Paciente de 24 años, peso 60 kg y estatura 1,77 m."));
    expect(r.documento).toBeUndefined();
  });

  it("descarta cifras demasiado cortas o largas para un documento", () => {
    expect(extractPatientIdentity(prosa("Cédula 123.")).documento).toBeUndefined();
    expect(extractPatientIdentity(prosa("Cédula 12345678901234.")).documento).toBeUndefined();
  });

  it("el campo estructurado manda sobre la prosa", () => {
    const note = [
      seccion("cedula", "Cédula", "8171924"),
      seccion("identificacion", "Identificación", "documento 1000471252"),
    ];
    expect(extractPatientIdentity(note).documento).toBe("8171924");
  });
});
