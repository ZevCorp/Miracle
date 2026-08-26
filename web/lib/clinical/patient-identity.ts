/**
 * Identidad del paciente dentro de la consulta: dónde se escribe y cómo se lee.
 *
 * POR QUÉ HACE FALTA: la consulta no exige asociar un paciente registrado (el
 * formulario dice "El paciente es opcional"), así que `consultations.patient_id`
 * viene casi siempre nulo y la tarjeta terminaba diciendo "Paciente sin
 * identificar" incluso cuando el nombre se había dicho en la consulta.
 *
 * DÓNDE SE ESCRIBE: en una sección de la nota, porque la plantilla es el único
 * contrato que existe entre la app y el motor que redacta. El generador llena
 * EXACTAMENTE las secciones del `template_snapshot` congelado al crear el
 * encounter, guiado por el `instruction` de cada una; no hay ningún otro canal
 * por el que pedirle un dato. Por eso la identificación se vuelve una sección
 * canónica —`identificacion_del_paciente`— que toda plantilla tiene garantizada
 * (trigger `private.ensure_template_patient_identity_section`), y su instrucción
 * pide un formato fijo de dos líneas:
 *
 *     Nombre: María Fernanda López
 *     Documento: 1023456789
 *
 * DE DÓNDE SE LEE, en orden de confianza:
 *
 *   1. LA SECCIÓN CANÓNICA. Es un campo con formato pedido, no prosa: se leen
 *      las líneas "Nombre:" y "Documento:" tal cual.
 *   2. SECCIONES ESTRUCTURADAS de patología ("Nombre del paciente", "Cédula").
 *      También son campos, y llevan más de 600 consultas funcionando así.
 *   3. PROSA DICTADA (sección "Identificación" de las plantillas viejas). Aquí
 *      el médico habla: "Paciente identificado como X, documento N". Se extrae
 *      con patrones ANCLADOS —nunca una palabra suelta con mayúscula ni un
 *      número suelto—: lo dudoso no se devuelve, porque un campo vacío lo llena
 *      el médico en dos segundos y uno con el nombre equivocado puede no verlo
 *      nadie. Se conserva para las notas anteriores a la sección canónica.
 *
 * NINGUNA DE LAS TRES ADIVINA. Si el nombre no está escrito bajo una etiqueta
 * que lo anuncie, esta función devuelve vacío y la consulta se queda en
 * "Paciente sin identificar", que es la respuesta correcta.
 *
 * CORRECCIONES AL DICTAR: al hablar es normal rectificar ("...documento 23-47-48.
 * Repito: 47-48-53-92"). Cuando aparece una marca de corrección seguida de
 * cifras, gana la última: es la que el médico quiso dejar.
 *
 * Esta lógica está DUPLICADA a propósito en SQL (trigger
 * `private.sync_consultation_patient_identity`), igual que ya ocurre con el
 * rótulo: las filas de `consultations` las escriben DOS procesos —el backend
 * clínico (ConsultationMirrorService), que vive fuera de este repo, y esta app—
 * así que la base es el único punto por el que pasan todas. Si cambias las
 * reglas aquí, cambia también la migración.
 */

import type { NoteSectionLike } from "./vital-concepts";

export interface PatientIdentity {
  nombre?: string;
  documento?: string;
}

/* ------------------------------------------------------------------ */
/* La sección canónica                                                 */
/* ------------------------------------------------------------------ */

/**
 * `key` de la sección de identificación. Es el ancla estable: el label lo puede
 * traducir o adornar una institución, la key no cambia (el backend la deriva del
 * label solo cuando la sección es nueva, y la PRESERVA al editar).
 *
 * Deliberadamente NO se llama `identificacion` a secas: esa palabra ya está
 * ocupada y significa otra cosa en dos especialidades —en bacteriología es la
 * del MICROORGANISMO y en laboratorio la VERIFICACIÓN del rótulo contra la
 * orden—. Un nombre propio evita tener que desambiguar por contexto.
 */
export const PATIENT_IDENTITY_SECTION_KEY = "identificacion_del_paciente";

export const PATIENT_IDENTITY_SECTION_LABEL = "Identificación del paciente";

/**
 * Lo que se le pide al modelo. Tres cosas, y las tres importan:
 *
 * - A QUIÉN identificar. El médico casi siempre se presenta primero ("soy el
 *   doctor Juan David Gómez"); sin decirlo explícitamente, su nombre es el
 *   primero que aparece en la transcripción y se cuela como el del paciente.
 * - EN QUÉ FORMATO. Dos líneas etiquetadas convierten la extracción en leer un
 *   campo. La prosa libre se perdía en una de cada tres consultas.
 * - QUÉ HACER SIN EL DATO. Una frase prudente explícita, para que el modelo no
 *   sienta que tiene que rellenar el hueco con algo.
 *
 * Máximo 400 caracteres: es el límite del editor de plantillas
 * (MAX_INSTRUCTION_LENGTH en template-builder), más estricto que el del backend.
 */
export const PATIENT_IDENTITY_SECTION_INSTRUCTION =
  "Identifica al PACIENTE, nunca al médico ni al acompañante: usa solo el nombre y el documento que el paciente da de sí mismo o que el médico dice del paciente. Escribe exactamente dos líneas: «Nombre: …» y «Documento: …». Si un dato no se dijo o no se entendió con certeza, escribe «No referido en la consulta.» en esa línea. Nunca lo deduzcas ni lo tomes de otra persona.";

/**
 * No es obligatoria a propósito. Marcarla `required` haría que toda consulta sin
 * identificación —urgencias, un paciente que no puede hablar— saliera con un
 * aviso de "sección obligatoria vacía". La ausencia ya se comunica sola: la
 * tarjeta dice "Paciente sin identificar".
 */
export const PATIENT_IDENTITY_SECTION = {
  key: PATIENT_IDENTITY_SECTION_KEY,
  label: PATIENT_IDENTITY_SECTION_LABEL,
  order: 1,
  required: false,
  instruction: PATIENT_IDENTITY_SECTION_INSTRUCTION,
} as const;

/* ------------------------------------------------------------------ */
/* Quién es el paciente de una consulta                                */
/* ------------------------------------------------------------------ */

/**
 * Identidad que se muestra de una consulta. UNA sola regla de precedencia para
 * toda la app —tarjetas, buscador, detalle, PDF—, porque cuando cada pantalla
 * decidía por su cuenta, la misma consulta salía con nombre en un sitio y como
 * "Paciente sin identificar" en otro.
 *
 * Manda el paciente registrado y asociado a mano: es un dato verificado contra
 * la ficha, no leído de un texto. Si no lo hay, vale la identificación que quedó
 * en la nota (columnas `paciente_nombre` / `paciente_documento`, que la base
 * mantiene sincronizadas). Si tampoco, no hay identidad y así se dice.
 */
export function resolveConsultationIdentity(
  registrado: { nombre?: string | null; documento?: string | null } | null | undefined,
  consulta:
    | { pacienteNombre?: string | null; pacienteDocumento?: string | null }
    | null
    | undefined,
): PatientIdentity {
  const nombre =
    registrado?.nombre?.trim() || consulta?.pacienteNombre?.trim() || undefined;
  const documento =
    registrado?.documento?.trim() || consulta?.pacienteDocumento?.trim() || undefined;
  return { nombre, documento };
}

/* ------------------------------------------------------------------ */
/* Lectura de secciones                                                */
/* ------------------------------------------------------------------ */

/** Nombre de la sección, sin tildes ni mayúsculas, para comparar sin sorpresas. */
function nombreDeSeccion(s: NoteSectionLike): string {
  return `${s?.key ?? ""} ${s?.id ?? ""} ${s?.label ?? ""} ${s?.titulo ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
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

/* ------------------------------------------------------------------ */
/* Limpieza y guardas                                                  */
/* ------------------------------------------------------------------ */

/**
 * Palabras que ocupan el lugar del nombre pero no lo son. Se comparan como
 * PREFIJO de palabra completa, no como frase exacta: la instrucción pide "No
 * referido en la consulta." y una lista de frases exactas nunca acierta con
 * todas las variantes que escribe un modelo ("No se mencionó el nombre",
 * "Sin datos de identificación"). Sin esta guarda, la consulta se llamaría "No".
 *
 * `\b` de palabra completa evita el falso positivo obvio: "Nora", "Noelia" y
 * "Nadia" empiezan por esas letras y son nombres de verdad.
 */
const NO_ES_NOMBRE =
  /^(no|sin|ninguno?|ninguna|pendiente|pendientes|desconocid[oa]|anonim[oa]|paciente|el paciente|la paciente|nn|na|n\/a|por (establecer|definir|confirmar))\b/;

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
  let nombre = bruto.replace(/\s+/g, " ").trim();
  // Un campo etiquetado suele traer el nombre y, detrás, otro dato: "María
  // Fernanda López (28 años)" o "... , 28 años". Se corta por el paréntesis o
  // el punto y coma siempre; por la coma SOLO si lo que sigue trae cifras, para
  // no partir "López, María Fernanda" (apellido primero, sin números).
  nombre = nombre.split(/[(;]/)[0].trim();
  if (/\d/.test(nombre)) nombre = nombre.split(",")[0].trim();
  nombre = nombre.replace(/[\s.,;:]+$/, "").trim();
  if (!nombre || nombre.length > 80) return undefined;
  if (/\d/.test(nombre)) return undefined;
  const llave = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (NO_ES_NOMBRE.test(llave)) return undefined;
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

/**
 * Primer número utilizable de una línea etiquetada. Se recorre corrida a
 * corrida en vez de arrasar con todos los no-dígitos porque en "1023456789,
 * expedida en 2015" lo segundo NO es parte del documento: pegarlos daría un
 * número de catorce cifras que no es de nadie.
 */
const CORRIDA_DE_DIGITOS = /[0-9][0-9 .\-]*/g;

function primerDocumentoDeLinea(linea: string): string | undefined {
  for (const m of linea.matchAll(CORRIDA_DE_DIGITOS)) {
    const limpio = limpiarDocumento(m[0]);
    if (limpio) return limpio;
  }
  return undefined;
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

/* ------------------------------------------------------------------ */
/* La sección canónica: leer un campo, no interpretar una frase        */
/* ------------------------------------------------------------------ */

/** Línea "Nombre: …" / "Nombre del paciente: …" dentro del campo canónico. */
const LINEA_NOMBRE = /^[ \t]*nombre\b[^:\n]*:[ \t]*(.+)$/im;
/** Línea "Documento: …" / "Cédula: …" / "Identificación: …". */
const LINEA_DOCUMENTO =
  /^[ \t]*(?:documento|c[ée]dula|identificaci[óo]n|cc|ti|nuip)\b[^:\n]*:[ \t]*(.+)$/im;

/**
 * Lee el campo canónico. Primero por sus líneas etiquetadas —que es el formato
 * que pide la instrucción— y, si el modelo se salió del formato, con los mismos
 * patrones anclados de la prosa. Lo que nunca hace es aceptar el contenido tal
 * cual: dentro de esta sección también se escribe "No referido en la consulta."
 */
interface LecturaDelCampo {
  identidad: PatientIdentity;
  /**
   * Campos que la casilla contestó explícitamente, aunque la respuesta fuera
   * "no se dijo". Una respuesta explícita cierra el asunto: no se sigue
   * buscando ese dato en otras secciones de la nota.
   */
  declarado: { nombre: boolean; documento: boolean };
}

function leerCampoCanonico(texto: string): LecturaDelCampo {
  const salida: PatientIdentity = {};
  const declarado = { nombre: false, documento: false };
  const contenido = (texto ?? "").trim();
  if (!contenido) return { identidad: salida, declarado };

  // Si la línea etiquetada existe, lo que diga es la respuesta —aunque la
  // respuesta sea "no se dijo"—. Solo cuando NO está se rescata el dato con los
  // patrones anclados: buscar un nombre dentro de un campo que ya declaró que no
  // hay ninguno es justamente cómo se acaba con un paciente llamado "Por".
  const lineaNombre = LINEA_NOMBRE.exec(contenido);
  if (lineaNombre?.[1]) {
    declarado.nombre = true;
    const limpio = limpiarNombre(lineaNombre[1]);
    if (limpio) salida.nombre = limpio;
  } else {
    const m = NOMBRE_EN_PROSA.exec(contenido);
    if (m?.[1]) {
      const limpio = limpiarNombre(m[1]);
      if (limpio) salida.nombre = limpio;
    }
  }

  const lineaDocumento = LINEA_DOCUMENTO.exec(contenido);
  if (lineaDocumento?.[1]) {
    declarado.documento = true;
    const limpio = primerDocumentoDeLinea(lineaDocumento[1]);
    if (limpio) salida.documento = limpio;
  } else {
    const doc = documentoEnProsa(contenido);
    if (doc) salida.documento = doc;
  }

  return { identidad: salida, declarado };
}

/** Lectura del campo canónico, para quien solo necesita el dato. */
export function parsePatientIdentitySection(texto: string): PatientIdentity {
  return leerCampoCanonico(texto).identidad;
}

/**
 * `identificacion` es un nombre de sección traicionero: en las plantillas de
 * bacteriología significa "Identificación del microorganismo", y en las de
 * laboratorio "Verificación de identificación" es el cotejo del rótulo con la
 * orden. Ninguna de las dos habla del paciente.
 */
function esSeccionDeIdentidadLegado(nombre: string): boolean {
  if (nombre.includes(PATIENT_IDENTITY_SECTION_KEY)) return false;
  if (!nombre.includes("identificacion")) return false;
  if (nombre.includes("microorganismo") || nombre.includes("germen")) return false;
  if (nombre.includes("verificacion")) return false;
  return true;
}

export function extractPatientIdentity(
  sections: readonly NoteSectionLike[] | null | undefined,
): PatientIdentity {
  const salida: PatientIdentity = {};

  // 1) Sección canónica: un campo con formato pedido.
  const canonica = buscarSeccion(sections, (n) =>
    n.includes(PATIENT_IDENTITY_SECTION_KEY),
  );
  const declarado = { nombre: false, documento: false };
  if (canonica) {
    const leido = leerCampoCanonico(canonica);
    if (leido.identidad.nombre) salida.nombre = leido.identidad.nombre;
    if (leido.identidad.documento) salida.documento = leido.identidad.documento;
    declarado.nombre = leido.declarado.nombre;
    declarado.documento = leido.declarado.documento;
  }

  // 2) Campos estructurados de patología.
  if (!salida.nombre && !declarado.nombre) {
    const nombreEstructurado = buscarSeccion(
      sections,
      (n) => n.includes("nombre") && n.includes("paciente"),
    );
    if (nombreEstructurado) {
      const limpio = limpiarNombre(nombreEstructurado);
      if (limpio) salida.nombre = limpio;
    }
  }
  if (!salida.documento && !declarado.documento) {
    const documentoEstructurado = buscarSeccion(
      sections,
      (n) => n.includes("cedula") || n.includes("documento"),
    );
    if (documentoEstructurado) {
      const limpio = limpiarDocumento(documentoEstructurado);
      if (limpio) salida.documento = limpio;
    }
  }

  // 3) Prosa de las plantillas anteriores a la sección canónica.
  if ((!salida.nombre && !declarado.nombre) || (!salida.documento && !declarado.documento)) {
    const prosa = buscarSeccion(sections, esSeccionDeIdentidadLegado);
    if (prosa) {
      if (!salida.nombre && !declarado.nombre) {
        const m = NOMBRE_EN_PROSA.exec(prosa);
        if (m?.[1]) {
          const limpio = limpiarNombre(m[1]);
          if (limpio) salida.nombre = limpio;
        }
      }
      if (!salida.documento && !declarado.documento) {
        const doc = documentoEnProsa(prosa);
        if (doc) salida.documento = doc;
      }
    }
  }

  return salida;
}
