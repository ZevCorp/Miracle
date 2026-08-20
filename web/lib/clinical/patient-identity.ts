/**
 * Saca NOMBRE y DOCUMENTO del paciente de la nota clínica.
 *
 * POR QUÉ HACE FALTA: la consulta no exige asociar un paciente registrado (el
 * formulario dice "El paciente es opcional"), así que `consultations.patient_id`
 * viene casi siempre nulo y la tarjeta terminaba diciendo "Paciente sin
 * identificar" incluso cuando el nombre estaba escrito dentro de la nota.
 *
 * DOS ORÍGENES, MUY DISTINTOS EN CONFIANZA:
 *
 *   1. SECCIONES ESTRUCTURADAS ("Nombre del paciente", "Cédula"). Las trae la
 *      plantilla de patología y son un campo, no prosa: lo que hay es el dato.
 *      Se leen tal cual.
 *
 *   2. PROSA DICTADA (sección "Identificación"). Aquí el médico habla: "Paciente
 *      identificado como X, con número de documento N". Se extrae con patrones
 *      ANCLADOS —nunca se toma una palabra suelta con mayúscula ni un número
 *      suelto—, siguiendo la misma disciplina de lib/clinical/vital-concepts.ts:
 *      lo dudoso no se devuelve, porque un campo vacío lo llena el médico en dos
 *      segundos y uno con el nombre equivocado puede no verlo nadie.
 *
 * CORRECCIONES AL DICTAR: al hablar es normal rectificar ("...documento 23-47-48.
 * Repito: 47-48-53-92"). Cuando aparece una marca de corrección seguida de
 * cifras, gana la última: es la que el médico quiso dejar.
 *
 * Esta lógica está DUPLICADA a propósito en SQL (trigger
 * `private.sync_consultation_patient_identity`), igual que ya ocurre con el
 * rótulo: las filas de `consultations` las publica el backend clínico, que vive
 * fuera de este repo, así que la base es el único punto por el que pasan todas.
 * Si cambias las reglas aquí, cambia también la migración.
 */

import type { NoteSectionLike } from "./vital-concepts";

export interface PatientIdentity {
  nombre?: string;
  documento?: string;
}

/** Nombre de la sección, sin tildes ni mayúsculas, para comparar sin sorpresas. */
function nombreDeSeccion(s: NoteSectionLike): string {
  return `${s?.key ?? ""} ${s?.label ?? ""} ${s?.titulo ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function textoDe(s: NoteSectionLike): string {
  return (s?.content ?? s?.texto ?? "").trim();
}

function buscarSeccion(
  sections: readonly NoteSectionLike[] | null | undefined,
  coincide: (nombre: string) => boolean,
): string {
  if (!Array.isArray(sections)) return "";
  for (const s of sections) {
    if (!s) continue;
    if (!coincide(nombreDeSeccion(s))) continue;
    const texto = textoDe(s);
    if (texto) return texto;
  }
  return "";
}

/**
 * Palabras que ocupan el lugar del nombre pero no lo son. Sin esta lista,
 * "Nombre: No referido" devolvería un paciente llamado "No".
 */
const NO_ES_NOMBRE = new Set([
  "no",
  "no referido",
  "no mencionado",
  "no registra",
  "sin",
  "sin dato",
  "sin datos",
  "ninguno",
  "ninguna",
  "anonimo",
  "desconocido",
  "paciente",
  "el paciente",
  "la paciente",
  "nn",
  "na",
]);

/**
 * El nombre debe empezar en mayúscula y solo continúa con otra mayúscula o con
 * una partícula ("de", "del", "la"...). Así se corta solo en la puntuación: en
 * "Nombre: Andrés Montero. Edad: 22 años" no se traga el "Edad".
 *
 * Ojo: sin bandera `i` a propósito. Las anclas llevan sus dos formas escritas
 * (`[Nn]ombre`) porque la mayúscula del nombre es justamente la señal que lo
 * distingue del resto de la frase.
 *
 * Las partículas van de la más larga a la más corta y con `\b`: probando "de"
 * antes que "del", "Nancy del Carmen Rojas" se quedaba en "Nancy de".
 */
const NOMBRE_EN_PROSA =
  /(?:[Nn]ombre(?:\s+de(?:l)?\s+paciente)?|[Ii]dentificad[oa]\s+como|[Ss]e\s+llama|[Ll]lamarse|[Ll]lamad[oa])\s*[:.]?\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+(?:(?:del|de|las|los|la|y)\b|[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+))*)/;

const DOCUMENTO_ANCLADO =
  /(?:c[ée]dula|documento|identificaci[óo]n)\s*(?:n[úu]mero\s*)?[:\s]*([0-9][0-9 .\-]{4,20})/gi;

const CORRECCION_DICTADA =
  /(?:repito|corrijo|perd[óo]n|mejor dicho|es decir)\s*[:,]?\s*([0-9][0-9 .\-]{4,20})/i;

function limpiarNombre(bruto: string): string | undefined {
  const nombre = bruto
    .replace(/[\s.,;:]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!nombre || nombre.length > 80) return undefined;
  if (/\d/.test(nombre)) return undefined;
  const llave = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (NO_ES_NOMBRE.has(llave)) return undefined;
  return nombre;
}

/**
 * Un documento colombiano tiene entre 5 y 12 dígitos (cédula, tarjeta de
 * identidad, NUIP). Se guardan solo las cifras: al dictar se agrupan de mil
 * maneras ("23-47-48", "1.089.934.418") y todas significan lo mismo.
 */
function limpiarDocumento(bruto: string): string | undefined {
  const digitos = bruto.replace(/\D/g, "");
  if (digitos.length < 5 || digitos.length > 12) return undefined;
  return digitos;
}

function documentoEnProsa(texto: string): string | undefined {
  // Una corrección explícita manda sobre todo lo dicho antes.
  const correccion = CORRECCION_DICTADA.exec(texto);
  if (correccion?.[1]) {
    const limpio = limpiarDocumento(correccion[1]);
    if (limpio) return limpio;
  }
  // Si no la hay, vale la última cifra anclada a su etiqueta: al dictar, lo que
  // viene después suele ser lo ya rectificado.
  let ultimo: string | undefined;
  for (const m of texto.matchAll(DOCUMENTO_ANCLADO)) {
    const limpio = limpiarDocumento(m[1] ?? "");
    if (limpio) ultimo = limpio;
  }
  return ultimo;
}

/**
 * `identificacion` es un nombre de sección traicionero: en las plantillas de
 * bacteriología significa "Identificación del microorganismo", y en las de
 * laboratorio "Verificación de identificación" es el cotejo del rótulo con la
 * orden. Ninguna de las dos habla del paciente.
 */
function esSeccionDeIdentidad(nombre: string): boolean {
  if (!nombre.includes("identificacion")) return false;
  if (nombre.includes("microorganismo") || nombre.includes("germen")) return false;
  if (nombre.includes("verificacion")) return false;
  return true;
}

export function extractPatientIdentity(
  sections: readonly NoteSectionLike[] | null | undefined,
): PatientIdentity {
  const salida: PatientIdentity = {};

  const nombreEstructurado = buscarSeccion(
    sections,
    (n) => n.includes("nombre") && n.includes("paciente"),
  );
  if (nombreEstructurado) {
    const limpio = limpiarNombre(nombreEstructurado);
    if (limpio) salida.nombre = limpio;
  }

  const documentoEstructurado = buscarSeccion(
    sections,
    (n) => n.includes("cedula") || n.includes("documento"),
  );
  if (documentoEstructurado) {
    const limpio = limpiarDocumento(documentoEstructurado);
    if (limpio) salida.documento = limpio;
  }

  // La prosa solo rellena lo que el campo estructurado no trajo.
  if (!salida.nombre || !salida.documento) {
    const prosa = buscarSeccion(sections, esSeccionDeIdentidad);
    if (prosa) {
      if (!salida.nombre) {
        const m = NOMBRE_EN_PROSA.exec(prosa);
        if (m?.[1]) {
          const limpio = limpiarNombre(m[1]);
          if (limpio) salida.nombre = limpio;
        }
      }
      if (!salida.documento) {
        const doc = documentoEnProsa(prosa);
        if (doc) salida.documento = doc;
      }
    }
  }

  return salida;
}
