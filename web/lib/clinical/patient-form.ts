import {
  canonicalizeDocumento,
  type DocumentoCanonico,
} from "@/lib/clinical/patient-identity";
import type { Patient } from "@/lib/mock/types";

/**
 * EL ALTA DE UN PACIENTE, en un solo sitio.
 *
 * Crear un paciente se pedía desde cuatro superficies distintas —el directorio,
 * antes de grabar, dentro de la consulta, la ficha— y cada una traía su propio
 * formulario, su propia validación y su propia idea de qué es un documento.
 * Resultado: el mismo paciente entraba como "CC 1023456789" por un lado y como
 * "1.023.456.789" por otro, y nadie detectaba que ya existía.
 *
 * Este módulo es la regla única: qué campos tiene un paciente, cómo se validan,
 * cómo se escribe el documento y cuándo dos fichas son la misma persona. El
 * diálogo pinta; esto decide.
 */

/** Lo que el formulario tiene en la mano. Todo texto: es lo que hay en los
 *  campos, aún sin normalizar. */
export interface PatientDraft {
  nombre: string;
  /** Sigla del tipo de documento ("CC", "TI", …) o "" si no se eligió. */
  documentoTipo: string;
  documentoNumero: string;
  edad: string;
  sexo: "F" | "M" | "";
  eps: string;
  telefono: string;
  antecedentes: string[];
  alergias: string[];
  medicamentos: string[];
}

/** Lo que sale hacia el store y la base: ya normalizado, con null donde no hay
 *  dato (nunca un "Por registrar" guardado como si fuera un valor). */
export interface PatientPayload {
  nombre: string;
  documento: string | null;
  edad: number | null;
  sexo: "F" | "M" | null;
  eps: string | null;
  telefono: string | null;
  antecedentes: string[];
  alergias: string[];
  medicamentos: string[];
}

/**
 * Tipos de documento de Colombia, en el orden en que se usan en consulta. Es un
 * subconjunto de SIGLAS_DOCUMENTO (patient-identity) a propósito: ahí hay
 * siglas que solo aparecen leyendo una transcripción (NIT, AS, MS), y ofrecer
 * "NIT" en el alta de un paciente es invitar al error.
 */
export const TIPOS_DOCUMENTO = [
  { sigla: "CC", label: "Cédula de ciudadanía" },
  { sigla: "TI", label: "Tarjeta de identidad" },
  { sigla: "RC", label: "Registro civil" },
  { sigla: "CE", label: "Cédula de extranjería" },
  { sigla: "PA", label: "Pasaporte" },
  { sigla: "PPT", label: "Permiso por protección temporal" },
  { sigla: "PEP", label: "Permiso especial de permanencia" },
  { sigla: "NUIP", label: "NUIP" },
  { sigla: "MS", label: "Menor sin identificación" },
] as const;

/** Placeholders que el store escribe en memoria cuando el dato no existe. No
 *  son valores: al abrir la ficha para editar tienen que volver a ser vacío. */
const PLACEHOLDERS = new Set(["por registrar", "—", "-", "sin registrar", "n/a"]);

export const LIMITES = {
  nombre: 120,
  documento: 32,
  eps: 80,
  telefono: 40,
  edadMax: 130,
  /** Tope por elemento de antecedentes / alergias / medicamentos. */
  item: 120,
  /** Cuántos elementos caben en cada lista. */
  items: 40,
} as const;

function limpio(valor: string | null | undefined): string {
  const texto = (valor ?? "").trim();
  return PLACEHOLDERS.has(texto.toLowerCase()) ? "" : texto;
}

export function emptyPatientDraft(
  inicial: Partial<Pick<PatientDraft, "nombre" | "documentoNumero">> = {},
): PatientDraft {
  return {
    nombre: inicial.nombre ?? "",
    // CC por defecto: es el documento de nueve de cada diez adultos. Se cambia
    // en un clic, y preseleccionarlo ahorra ese clic la mayoría de las veces.
    documentoTipo: "CC",
    documentoNumero: inicial.documentoNumero ?? "",
    edad: "",
    sexo: "",
    eps: "",
    telefono: "",
    antecedentes: [],
    alergias: [],
    medicamentos: [],
  };
}

/**
 * La ficha guardada, de vuelta al formulario. El documento vive en la base como
 * UN texto ("CC 1023456789"), así que hay que partirlo en tipo y número con el
 * mismo lector que usa la nota — si no, editar un paciente y guardar sin tocar
 * nada le cambiaría el documento.
 */
export function draftFromPatient(patient: Patient): PatientDraft {
  const documento = limpio(patient.documento);
  const canonico: DocumentoCanonico | undefined = documento
    ? canonicalizeDocumento(documento)
    : undefined;

  return {
    nombre: patient.nombre ?? "",
    // Un tipo que no está en la lista (o un documento ilegible) no se inventa:
    // queda sin tipo y el número conserva el texto tal cual se guardó.
    documentoTipo:
      canonico?.tipo && TIPOS_DOCUMENTO.some((t) => t.sigla === canonico.tipo)
        ? canonico.tipo
        : "",
    documentoNumero: canonico?.numero ?? documento,
    edad: patient.edad > 0 ? String(patient.edad) : "",
    sexo: patient.sexo ?? "",
    eps: limpio(patient.eps),
    telefono: limpio(patient.telefono),
    antecedentes: [...(patient.antecedentes ?? [])],
    alergias: [...(patient.alergias ?? [])],
    medicamentos: [...(patient.medicamentos ?? [])],
  };
}

/** El documento como se escribe: "CC 1023456789", o solo el número si no se
 *  eligió tipo. Sin separadores — la forma canónica de toda la app. */
export function formatDocumento(tipo: string, numero: string): string | null {
  const limpioNumero = numero.trim().replace(/[\s.\-]/g, "").toUpperCase();
  if (!limpioNumero) return null;
  const sigla = tipo.trim().toUpperCase();
  return sigla ? `${sigla} ${limpioNumero}` : limpioNumero;
}

/**
 * La clave con la que se compara si dos fichas son la misma persona: SOLO el
 * número, sin tipo ni separadores. "CC 1.023.456.789" y "1023456789" son el
 * mismo paciente, y el sistema tiene que verlo.
 */
export function documentoKey(documento: string | null | undefined): string | null {
  const texto = limpio(documento);
  if (!texto) return null;
  const canonico = canonicalizeDocumento(texto);
  if (canonico) return canonico.numero.toUpperCase();
  // Sin forma canónica (un documento raro escrito a mano) se compara el texto
  // desnudo: peor que nada no es.
  const desnudo = texto.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  return desnudo || null;
}

/** Nombre comparable: sin tildes, sin mayúsculas, sin espacios de más. */
export function nombreKey(nombre: string | null | undefined): string {
  return (nombre ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

export function validatePatientDraft(draft: PatientDraft): string | null {
  const nombre = draft.nombre.trim();
  if (nombre.length < 2) {
    return "Escribe el nombre completo del paciente.";
  }
  if (nombre.length > LIMITES.nombre) {
    return `El nombre no puede pasar de ${LIMITES.nombre} caracteres.`;
  }

  const numero = draft.documentoNumero.trim();
  if (numero) {
    if (numero.replace(/[\s.\-]/g, "").length > LIMITES.documento) {
      return "El número de documento es demasiado largo.";
    }
    if (!/[0-9]/.test(numero)) {
      return "El número de documento tiene que llevar cifras.";
    }
  }

  const edad = draft.edad.trim();
  if (edad) {
    const valor = Number.parseInt(edad, 10);
    // El rango lo impone también la base (check edad between 0 and 130); se
    // valida aquí para que el error salga en el campo y no como fallo de red.
    if (!Number.isFinite(valor) || valor < 0 || valor > LIMITES.edadMax) {
      return `La edad tiene que estar entre 0 y ${LIMITES.edadMax} años.`;
    }
  }

  if (draft.eps.trim().length > LIMITES.eps) return "La EPS es demasiado larga.";
  if (draft.telefono.trim().length > LIMITES.telefono) {
    return "El teléfono es demasiado largo.";
  }

  return null;
}

export function payloadFromDraft(draft: PatientDraft): PatientPayload {
  const edad = Number.parseInt(draft.edad.trim(), 10);
  const lista = (valores: string[]) =>
    valores
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, LIMITES.items);

  return {
    nombre: draft.nombre.trim(),
    documento: formatDocumento(draft.documentoTipo, draft.documentoNumero),
    edad: Number.isFinite(edad) && edad >= 0 ? edad : null,
    sexo: draft.sexo || null,
    eps: draft.eps.trim() || null,
    telefono: draft.telefono.trim() || null,
    antecedentes: lista(draft.antecedentes),
    alergias: lista(draft.alergias),
    medicamentos: lista(draft.medicamentos),
  };
}

export type DuplicateReason = "documento" | "nombre";

export interface DuplicateMatch {
  patient: Patient;
  reason: DuplicateReason;
}

/**
 * ¿Esta persona ya está en la lista?
 *
 * Dos señales, y no valen lo mismo. El documento es identidad: si coincide, es
 * la misma persona y crear otra ficha parte su historia en dos. El nombre es
 * indicio: hay dos Juan Carlos Gómez, y bloquear por nombre haría imposible
 * registrar al segundo. Por eso el diálogo trata una como freno y la otra como
 * advertencia.
 */
export function findDuplicates(
  patients: readonly Patient[],
  draft: PatientDraft,
  excludeId?: string,
): DuplicateMatch[] {
  const docKey = documentoKey(formatDocumento(draft.documentoTipo, draft.documentoNumero));
  const nomKey = nombreKey(draft.nombre);
  const salida: DuplicateMatch[] = [];

  for (const patient of patients) {
    if (patient.id === excludeId) continue;
    if (docKey && documentoKey(patient.documento) === docKey) {
      salida.push({ patient, reason: "documento" });
      continue;
    }
    if (nomKey.length >= 5 && nombreKey(patient.nombre) === nomKey) {
      salida.push({ patient, reason: "nombre" });
    }
  }

  // El documento manda: si hay coincidencia dura, va primero.
  return salida
    .sort((a, b) => (a.reason === b.reason ? 0 : a.reason === "documento" ? -1 : 1))
    .slice(0, 4);
}
