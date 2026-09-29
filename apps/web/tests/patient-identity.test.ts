import { describe, it, expect } from "vitest";
import {
  canonicalizeDocumento,
  canonicalizeNoteIdentity,
  extractPatientIdentity,
  PATIENT_IDENTITY_SECTION_KEY,
} from "@/lib/clinical/patient-identity";

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

/* ------------------------------------------------------------------ */
/* La sección canónica: el camino de las consultas nuevas              */
/* ------------------------------------------------------------------ */

/** Sección como la guarda el store local: la key viaja en `id`, no en `key`. */
function campo(id: string, titulo: string, texto: string) {
  return { id, titulo, kind: "texto" as const, texto };
}

function identificacion(texto: string) {
  return [campo("identificacion_del_paciente", "Identificación del paciente", texto)];
}

describe("sección canónica de identificación", () => {
  it("Caso 1 · nombre y documento dichos en la consulta", () => {
    const r = extractPatientIdentity(
      identificacion("Nombre: María Fernanda López\nDocumento: 123456789"),
    );
    expect(r).toEqual({ nombre: "María Fernanda López", documento: "123456789" });
  });

  it("Caso 2 · solo el nombre: el documento queda pendiente, no inventado", () => {
    const r = extractPatientIdentity(
      identificacion("Nombre: Carlos Andrés Pérez\nDocumento: No referido en la consulta."),
    );
    expect(r.nombre).toBe("Carlos Andrés Pérez");
    expect(r.documento).toBeUndefined();
  });

  it("Caso 3 · sin identificación: los dos campos quedan vacíos", () => {
    const r = extractPatientIdentity(
      identificacion(
        "Nombre: No referido en la consulta.\nDocumento: No referido en la consulta.",
      ),
    );
    expect(r).toEqual({});
  });

  it("Caso 4 · el nombre del médico no se cuela desde otra sección", () => {
    // El médico se presenta primero y su nombre es el primero de la
    // transcripción: si la lectura no estuviera atada a la casilla, ganaría él.
    const note = [
      campo("identificacion_del_paciente", "Identificación del paciente", "Nombre: Carlos Andrés Pérez\nDocumento: No referido en la consulta."),
      campo("motivo_de_consulta", "Motivo de consulta", "Atendido por el doctor Juan David Gómez, médico general."),
    ];
    expect(extractPatientIdentity(note).nombre).toBe("Carlos Andrés Pérez");
  });

  it("lee el documento aunque venga con el tipo delante", () => {
    const r = extractPatientIdentity(
      identificacion("Nombre: Ana Sofía Ramírez\nDocumento: CC 1.023.456.789"),
    );
    expect(r.documento).toBe("1023456789");
  });

  it("no pega el año de expedición al número de documento", () => {
    // Arrasando con los no-dígitos salía un número de catorce cifras.
    const r = extractPatientIdentity(
      identificacion("Nombre: Jorge Niño\nDocumento: 1023456789, expedida en 2015"),
    );
    expect(r.documento).toBe("1023456789");
  });

  it("recorta la edad pegada al nombre", () => {
    expect(
      extractPatientIdentity(identificacion("Nombre: María Fernanda López (28 años)")).nombre,
    ).toBe("María Fernanda López");
    expect(
      extractPatientIdentity(identificacion("Nombre: María Fernanda López, 28 años")).nombre,
    ).toBe("María Fernanda López");
  });

  it("no parte un nombre escrito con el apellido primero", () => {
    // Sin cifras detrás, la coma es parte del nombre y no un dato pegado.
    expect(
      extractPatientIdentity(identificacion("Nombre: López, María Fernanda")).nombre,
    ).toBe("López, María Fernanda");
  });

  it("rescata el dato aunque el modelo se salga del formato de dos líneas", () => {
    const r = extractPatientIdentity(
      identificacion("Paciente identificada como Camila Flores, con cédula 1089934418."),
    );
    expect(r).toEqual({ nombre: "Camila Flores", documento: "1089934418" });
  });

  it("manda sobre la prosa de la plantilla vieja", () => {
    const note = [
      campo("identificacion_del_paciente", "Identificación del paciente", "Nombre: Ana Gómez\nDocumento: 1040181619"),
      campo("identificacion", "Identificación", "Paciente identificado como Pablo Maldonado, cédula 8171924."),
    ];
    expect(extractPatientIdentity(note)).toEqual({
      nombre: "Ana Gómez",
      documento: "1040181619",
    });
  });

  it.each([
    "Nombre: No se mencionó",
    "Nombre: Sin datos de identificación",
    "Nombre: Pendiente",
    "Nombre: Desconocido",
    "Nombre: Anónimo",
    "Nombre: Paciente sin identificar",
    "Nombre: NN",
    "Nombre: Por establecer",
  ])("no acepta un relleno como nombre: %j", (texto) => {
    expect(extractPatientIdentity(identificacion(texto)).nombre).toBeUndefined();
  });

  it.each(["Nora Restrepo", "Noelia Vargas", "Nadia Sánchez", "Ninoska Ramírez"])(
    "sí acepta nombres que empiezan como un relleno: %j",
    (nombre) => {
      expect(extractPatientIdentity(identificacion(`Nombre: ${nombre}`)).nombre).toBe(nombre);
    },
  );
});

/* ------------------------------------------------------------------ */
/* El documento: una sola forma canónica                               */
/* ------------------------------------------------------------------ */

describe("canonicalizeDocumento", () => {
  it.each([
    ["1036457892", "1036457892"],
    ["1 036 457 892", "1036457892"],
    ["1.036.457.892", "1036457892"],
    // La forma que mete el proveedor de transcripción al dictar por grupos.
    ["23-45-67-75-43", "2345677543"],
    ["23-47-48", "234748"],
    ["  1036457892  ", "1036457892"],
  ])("quita los separadores de %j", (bruto, esperado) => {
    expect(canonicalizeDocumento(bruto)?.numero).toBe(esperado);
  });

  it.each([
    ["uno cero tres seis cuatro cinco siete ocho nueve dos", "1036457892"],
    ["veintitrés cuarenta y siete cuarenta y ocho", "234748"],
    ["dos tres cuatro siete cuatro ocho", "234748"],
  ])("entiende las cifras dictadas en palabras: %j", (bruto, esperado) => {
    expect(canonicalizeDocumento(bruto)?.numero).toBe(esperado);
  });

  it("no adivina cuando la cifra dictada sale de lo que sabe leer", () => {
    // "mil" abre la puerta a un número a medio traducir: mejor vacío que mal.
    expect(canonicalizeDocumento("un millón veintitrés mil")).toBeUndefined();
  });

  it("conserva el tipo dictado y lo normaliza a su sigla", () => {
    expect(canonicalizeDocumento("CC 1.023.456.789")).toMatchObject({
      tipo: "CC",
      numero: "1023456789",
      texto: "CC 1023456789",
    });
    expect(canonicalizeDocumento("cédula de ciudadanía 1023456789")?.tipo).toBe("CC");
    expect(canonicalizeDocumento("tarjeta de identidad 1023456789")?.tipo).toBe("TI");
  });

  it("no le quita las letras a un pasaporte", () => {
    // Arrasar con los no-dígitos convertía "AY123456" en "123456": el
    // documento de nadie.
    expect(canonicalizeDocumento("AY123456")).toMatchObject({
      numero: "AY123456",
      texto: "AY123456",
    });
    expect(canonicalizeDocumento("PA ay-123456")?.texto).toBe("PA AY123456");
  });

  it("no se traga lo que viene detrás del número", () => {
    expect(canonicalizeDocumento("1023456789, expedida en 2015")?.numero).toBe("1023456789");
    expect(canonicalizeDocumento("1023456789 expedida en Bogotá")?.numero).toBe("1023456789");
  });

  it.each([
    "No referido en la consulta.",
    "1234",
    "12345678901234567",
    "",
    "   ",
  ])("no devuelve documento para %j", (bruto) => {
    expect(canonicalizeDocumento(bruto)).toBeUndefined();
  });
});

describe("canonicalizeNoteIdentity", () => {
  const seccionCon = (texto: string) => ({
    sections: [
      { key: PATIENT_IDENTITY_SECTION_KEY, label: "Identificación del paciente", content: texto },
      { key: "motivo_de_consulta", label: "Motivo de consulta", content: "Dolor de cabeza 23-45-67." },
    ],
  });

  it("deja el documento sin separadores en la nota, no solo en la columna", () => {
    const note = canonicalizeNoteIdentity(
      seccionCon("Nombre: María Fernanda López\nDocumento: 23-45-67-75-43"),
    );
    expect(note?.sections?.[0].content).toBe(
      "Nombre: María Fernanda López\nDocumento: 2345677543",
    );
  });

  it("no toca ninguna otra sección de la nota", () => {
    const note = canonicalizeNoteIdentity(
      seccionCon("Nombre: Ana Gómez\nDocumento: 1.023.456.789"),
    );
    // El "23-45-67" del motivo de consulta es texto clínico, no un documento.
    expect(note?.sections?.[1].content).toBe("Dolor de cabeza 23-45-67.");
  });

  it("conserva lo que el médico escribió detrás del número", () => {
    const note = canonicalizeNoteIdentity(
      seccionCon("Documento: 1.023.456.789, expedida en Medellín"),
    );
    expect(note?.sections?.[0].content).toBe("Documento: 1023456789, expedida en Medellín");
  });

  it("deja intacta la línea cuando no hay un documento que reconocer", () => {
    const texto = "Nombre: Ana Gómez\nDocumento: No referido en la consulta.";
    expect(canonicalizeNoteIdentity(seccionCon(texto))?.sections?.[0].content).toBe(texto);
  });

  it("devuelve la MISMA nota si no había nada que arreglar", () => {
    const original = seccionCon("Nombre: Ana Gómez\nDocumento: 1023456789");
    expect(canonicalizeNoteIdentity(original)).toBe(original);
  });

  it("aguanta notas vacías, nulas y sin secciones", () => {
    expect(canonicalizeNoteIdentity(null)).toBeNull();
    expect(canonicalizeNoteIdentity(undefined)).toBeUndefined();
    expect(canonicalizeNoteIdentity({ sections: [] })).toEqual({ sections: [] });
  });
});

describe("el documento con separadores llega limpio a la columna", () => {
  it.each([
    ["Nombre: Ana Gómez\nDocumento: 23-45-67-75-43", "2345677543"],
    ["Nombre: Ana Gómez\nDocumento: 1 036 457 892", "1036457892"],
    ["Nombre: Ana Gómez\nDocumento: uno cero tres seis cuatro cinco siete ocho nueve dos", "1036457892"],
  ])("extrae %j", (texto, esperado) => {
    const note = [
      { id: PATIENT_IDENTITY_SECTION_KEY, titulo: "Identificación del paciente", texto },
    ];
    expect(extractPatientIdentity(note).documento).toBe(esperado);
  });
});

/* ------------------------------------------------------------------ */
/* Rótulo ≠ documento                                                  */
/* ------------------------------------------------------------------ */

/**
 * El rótulo es el número de caso del laboratorio ("26-2931": año y
 * consecutivo). Sus guiones SIGNIFICAN algo, al revés que los que el proveedor
 * de transcripción le mete a una cédula dictada. Vive en su propia sección
 * (`rotulo`), tiene su propia columna y su propio trigger, y nada de lo que
 * hace la canonización del documento puede tocarlo.
 */
describe("el rótulo de patología no se canoniza", () => {
  const notaPatologia = [
    { key: "rotulo", label: "Rótulo", content: "26-2931" },
    { key: "nombre_paciente", label: "Nombre del paciente", content: "Rafael Enrique Vanegas" },
    { key: "cedula", label: "Cédula", content: "8171924" },
  ];

  it("no lo confunde con el documento del paciente", () => {
    const r = extractPatientIdentity(notaPatologia);
    expect(r.documento).toBe("8171924");
    expect(r.documento).not.toBe("262931");
  });

  it("no le quita los guiones: la nota sale igual que entró", () => {
    const note = canonicalizeNoteIdentity({ sections: notaPatologia });
    expect(note?.sections?.[0].content).toBe("26-2931");
    // Y como nada cambió, ni siquiera se reconstruye el objeto.
    expect(note?.sections).toBe(notaPatologia);
  });

  it("tampoco lo toca cuando convive con la casilla de identificación", () => {
    // Una plantilla puede tener rótulo Y sección canónica a la vez.
    const mixta = {
      sections: [
        { key: "rotulo", label: "Rótulo", content: "26-2931" },
        {
          key: PATIENT_IDENTITY_SECTION_KEY,
          label: "Identificación del paciente",
          content: "Nombre: Ana Gómez\nDocumento: 10-23-45-67-89",
        },
      ],
    };
    const note = canonicalizeNoteIdentity(mixta);
    expect(note?.sections?.[0].content).toBe("26-2931");
    expect(note?.sections?.[1].content).toBe("Nombre: Ana Gómez\nDocumento: 1023456789");
  });

  it("una línea de rótulo DENTRO de la casilla tampoco se canoniza", () => {
    // Solo se reescribe la línea etiquetada como documento; cualquier otra
    // etiqueta se queda como está.
    const note = canonicalizeNoteIdentity({
      sections: [
        {
          key: PATIENT_IDENTITY_SECTION_KEY,
          label: "Identificación del paciente",
          content: "Rótulo: 26-2931\nDocumento: 10-23-45-67-89",
        },
      ],
    });
    expect(note?.sections?.[0].content).toBe("Rótulo: 26-2931\nDocumento: 1023456789");
  });
});
