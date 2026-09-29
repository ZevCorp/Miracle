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
 * - CÓMO ESCRIBIR EL DOCUMENTO. Sin separadores, y dicho explícitamente
 *   "aunque la transcripción lo traiga separado": el proveedor de STT parte las
 *   cifras dictadas de a grupos como si fueran un teléfono ("23-45-67-75-43") y
 *   la regla de fidelidad del generador le manda copiarlas tal cual. Ver
 *   canonicalizeDocumento.
 *
 * Máximo 400 caracteres: es el límite del editor de plantillas
 * (MAX_INSTRUCTION_LENGTH en template-builder), más estricto que el del backend.
 */
export const PATIENT_IDENTITY_SECTION_INSTRUCTION =
  "Identifica al PACIENTE, nunca al médico ni al acompañante. Escribe dos líneas: «Nombre: …» y «Documento: …». El documento va como una sola cifra corrida, sin puntos, espacios ni guiones, aunque la transcripción lo traiga separado en grupos. Si un dato no se dijo o no se entendió con certeza, escribe «No referido en la consulta.» en esa línea. Nunca lo deduzcas ni lo tomes de otra persona.";

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

/* ------------------------------------------------------------------ */
/* El documento: una sola forma canónica                               */
/* ------------------------------------------------------------------ */

/**
 * POR QUÉ ESTO EXISTE: el número llega partido en grupos.
 *
 * No lo parte el modelo ni esta app: lo parte el PROVEEDOR DE TRANSCRIPCIÓN.
 * Deepgram (`smart_format`) y Soniox aplican normalización inversa de texto y,
 * ante una corrida larga de cifras dictadas de a pocas, la escriben como si
 * fuera un teléfono: "23-45-67-75-43". El cliente de dictado
 * (lib/stt/deepgram-dictation.js) solo concatena los tokens del proveedor —no
 * inserta nada— y el generador la copia tal cual, obedeciendo su propia regla
 * de fidelidad ("no reformatees rótulos tipo 26-3456"). Para cuando el texto
 * llega aquí, los guiones ya venían en la transcripción: se comprobó sobre los
 * datos reales (las 3 notas con guiones los tienen idénticos en su
 * transcripción, y 21 transcripciones más los traen).
 *
 * La transcripción NO se toca: es la evidencia de lo que se dijo. Lo que se
 * normaliza es el CAMPO, que tiene un formato declarado y una forma canónica.
 *
 * TIPOS QUE MANEJA MIRACLE: no hay un campo de tipo de documento; el tipo viaja
 * dentro del texto, como en `patients.documento` ("CC 1.023.456.789"). Los
 * documentos colombianos son numéricos —cédula, tarjeta de identidad, registro
 * civil, cédula de extranjería, NUIP— y su forma canónica es la cifra corrida
 * sin separadores. El pasaporte y el PPT son ALFANUMÉRICOS: quitarles las
 * letras, como se hacía antes, convertía "AY123456" en "123456", el documento
 * de nadie. Por eso la canonización mira si hay letras antes de decidir.
 */
export interface DocumentoCanonico {
  /** Sigla del tipo tal como se dictó, en mayúsculas ("CC", "TI", "PA"). */
  tipo?: string;
  /** El identificador sin separadores: la forma que se guarda y se compara. */
  numero: string;
  /** Cómo se escribe en la nota: "CC 1023456789" o "1023456789". */
  texto: string;
  /**
   * Cuántos caracteres del texto de entrada ocupó el documento. Lo necesita
   * quien reescribe la línea, para conservar intacto lo que venga detrás
   * ("…, expedida en Medellín") en vez de recortarlo.
   */
  consumido: number;
}

/** Siglas de documento de identidad usadas en Colombia. */
const SIGLAS_DOCUMENTO = new Set([
  "CC", "TI", "RC", "CE", "PA", "PP", "PPT", "PEP", "NUIP", "NIT", "MS", "AS", "CN", "SC",
]);

/** Palabras con las que se dicta el tipo, y la sigla a la que corresponden. */
const TIPO_DICTADO: Record<string, string> = {
  cedula: "CC",
  ciudadania: "CC",
  tarjeta: "TI",
  registro: "RC",
  extranjeria: "CE",
  pasaporte: "PA",
  nuip: "NUIP",
};

/** Un documento numérico va de 5 a 12 dígitos (cédula, TI, RC, CE, NUIP). */
const MIN_DIGITOS = 5;
const MAX_DIGITOS = 12;
/** El alfanumérico (pasaporte, PPT) es más corto y más variado. */
const MIN_ALFANUMERICO = 5;
const MAX_ALFANUMERICO = 20;

/**
 * Lleva un documento dictado a su forma canónica.
 *
 * Devuelve `undefined` cuando lo que hay no es un documento —una frase
 * prudente, un año suelto, una cifra fuera de rango—: igual que con el nombre,
 * un campo vacío lo llena el médico en dos segundos y uno equivocado puede no
 * verlo nadie.
 */
/**
 * Cifras dictadas EN PALABRAS ("uno cero tres seis…", "veintitrés cuarenta y
 * siete…"). Normalmente el proveedor de transcripción ya las convierte, pero
 * cuando no lo hace el número se perdía entero.
 *
 * Cobertura deliberadamente corta: unidades y decenas (0–99), que es como se
 * dicta un documento —cifra a cifra o en grupos de dos—. Ante cualquier palabra
 * fuera de esa lista ("mil", "millones") NO se adivina: se devuelve vacío y el
 * campo queda pendiente. Un documento a medio traducir es peor que uno vacío.
 */
const PALABRA_A_NUMERO: Record<string, number> = {
  cero: 0, uno: 1, una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veintiuno: 21, veintiuna: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26,
  veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40,
  cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
};
const DECENAS = new Set([30, 40, 50, 60, 70, 80, 90]);

function digitosDePalabras(texto: string): string | undefined {
  const palabras = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[\s.,-]+/)
    .filter(Boolean);
  if (!palabras.length) return undefined;

  let salida = "";
  let pendiente: number | null = null;
  for (const palabra of palabras) {
    if (palabra === "y") {
      // Solo une una decena con su unidad: "cuarenta y siete".
      if (pendiente === null || !DECENAS.has(pendiente)) return undefined;
      continue;
    }
    const valor = PALABRA_A_NUMERO[palabra];
    if (valor === undefined) return undefined;
    if (pendiente !== null && DECENAS.has(pendiente) && valor >= 1 && valor <= 9) {
      salida += String(pendiente + valor);
      pendiente = null;
      continue;
    }
    if (pendiente !== null) salida += String(pendiente);
    pendiente = valor;
  }
  if (pendiente !== null) salida += String(pendiente);
  return salida || undefined;
}

export function canonicalizeDocumento(
  bruto: string | null | undefined,
): DocumentoCanonico | undefined {
  const entrada = bruto ?? "";
  const inicio = entrada.length - entrada.trimStart().length;
  const texto = entrada.trim();
  if (!texto) return undefined;

  // El tipo puede venir como sigla ("CC 1023456789") o dictado en palabras
  // ("cédula de ciudadanía 1023456789"). Se separa del identificador para no
  // confundir sus letras con las de un pasaporte.
  let tipo: string | undefined;
  let resto = texto;
  const sigla = /^([A-Za-z]{2,4})[\s.:-]+(.+)$/.exec(resto);
  if (sigla && SIGLAS_DOCUMENTO.has(sigla[1].toUpperCase())) {
    tipo = sigla[1].toUpperCase();
    resto = sigla[2];
  } else {
    const palabras = /^((?:[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+[\s.]+){1,4})(.*)$/.exec(resto);
    if (palabras) {
      const sueltas = palabras[1]
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .split(/[\s.]+/);
      for (const palabra of sueltas) {
        const encontrado = TIPO_DICTADO[palabra];
        if (encontrado) {
          tipo = encontrado;
          resto = palabras[2];
          break;
        }
      }
    }
  }
  const prefijo = texto.length - resto.length;
  const espacios = resto.length - resto.trimStart().length;
  resto = resto.trimStart();

  // DOS FORMAS, y hay que distinguirlas antes de recortar:
  //
  //   alfanumérica (pasaporte, PPT): UN token pegado, sin espacios, que mezcla
  //     letras y cifras ("AY123456").
  //   numérica (cédula, TI, RC, CE, NUIP): una corrida de cifras que SÍ puede
  //     traer separadores, porque así es como llega del dictado
  //     ("1 036 457 892", "23-45-67-75-43", "1.023.456.789").
  //
  // La distinción importa: una corrida que aceptara letras Y espacios se
  // tragaría lo que viene detrás —"1023456789 expedida en Bogotá" acabaría
  // siendo un "documento" de treinta caracteres— y el campo se perdería entero.
  // El token alfanumérico admite separadores INTERNOS pero nunca espacios
  // ("ay-123456" es un pasaporte; "1023456789 expedida en Bogotá" no es un
  // token alfanumérico de treinta caracteres).
  const token = (/^[0-9A-Za-z]+(?:[.\-][0-9A-Za-z]+)*/.exec(resto)?.[0] ?? "")
    .replace(/[.\-]/g, "");
  const esAlfanumerico = /[A-Za-z]/.test(token) && /[0-9]/.test(token);
  const crudo = esAlfanumerico
    ? (/^[0-9A-Za-z]+(?:[.\-][0-9A-Za-z]+)*/.exec(resto)?.[0] ?? "")
    : (/^[0-9][0-9 .\-]*/.exec(resto)?.[0] ?? "");

  // Sin una sola cifra escrita, aún puede estar dictado en palabras.
  if (!crudo) {
    if (/[0-9]/.test(resto)) return undefined;
    const enPalabras = digitosDePalabras(resto);
    if (!enPalabras) return undefined;
    if (enPalabras.length < MIN_DIGITOS || enPalabras.length > MAX_DIGITOS) {
      return undefined;
    }
    return {
      tipo,
      numero: enPalabras,
      texto: tipo ? `${tipo} ${enPalabras}` : enPalabras,
      consumido: entrada.length,
    };
  }

  const numero = crudo.replace(/[\s.\-]/g, "").toUpperCase();
  if (esAlfanumerico) {
    if (numero.length < MIN_ALFANUMERICO || numero.length > MAX_ALFANUMERICO) {
      return undefined;
    }
  } else if (numero.length < MIN_DIGITOS || numero.length > MAX_DIGITOS) {
    return undefined;
  }

  return {
    tipo,
    numero,
    texto: tipo ? `${tipo} ${numero}` : numero,
    consumido: inicio + prefijo + espacios + crudo.trimEnd().length,
  };
}

/**
 * El identificador canónico solo, que es lo que se guarda en la columna y con
 * lo que se compara y se busca.
 */
function limpiarDocumento(bruto: string): string | undefined {
  return canonicalizeDocumento(bruto)?.numero;
}

/**
 * Documento de una línea etiquetada ("Documento: CC 1.023.456.789").
 *
 * La línea entera va a la canonización, que ya sabe separar el tipo del
 * identificador y quedarse con la primera corrida: si se buscara "el primer
 * número" a secas, "CC 1023456789" perdería el "CC" y "PA AY123456" perdería
 * las letras del pasaporte.
 */
function primerDocumentoDeLinea(linea: string): DocumentoCanonico | undefined {
  const directo = canonicalizeDocumento(linea);
  if (directo) return directo;
  // La línea puede empezar con algo que no es el documento ("Número de
  // documento 1023456789"): se reintenta desde cada cifra.
  for (const m of linea.matchAll(/[0-9][0-9A-Za-z .\-]*/g)) {
    const canonico = canonicalizeDocumento(m[0]);
    if (canonico) return canonico;
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
    const canonico = primerDocumentoDeLinea(lineaDocumento[1]);
    if (canonico) salida.documento = canonico.numero;
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

/* ------------------------------------------------------------------ */
/* Dejar el campo canónico en su forma canónica antes de persistirlo   */
/* ------------------------------------------------------------------ */

/**
 * Reescribe la línea "Documento:" del campo de identificación con la forma
 * canónica del documento. Devuelve el MISMO texto si no hay nada que arreglar.
 *
 * POR QUÉ SE REESCRIBE EL TEXTO Y NO SOLO LA COLUMNA: la columna
 * `paciente_documento` ya guardaba solo las cifras, así que las listas y el
 * buscador siempre estuvieron bien. Lo que quedaba mal era la nota —lo que el
 * médico lee y lo que sale impreso en el PDF—, porque ahí vive el texto tal
 * como lo escribió el generador, con los guiones que puso el proveedor de
 * transcripción.
 *
 * POR QUÉ ES SEGURO HACERLO: esto NO edita la historia clínica a espaldas de
 * nadie. Toca una sola línea de un CAMPO CON FORMATO DECLARADO —la instrucción
 * de la sección pide exactamente "Documento: <cifra corrida>"— y solo cuando la
 * línea existe y su contenido resuelve a un documento válido. Los mismos
 * dígitos, en el orden en que se dijeron, sin separadores: no se añade ni se
 * quita información. Si el modelo escribió prosa en vez del formato pedido, no
 * se toca nada; y la TRANSCRIPCIÓN nunca se modifica, porque es la evidencia de
 * lo que de verdad se dijo.
 */
export function canonicalizeIdentitySectionText(texto: string): string {
  const contenido = texto ?? "";
  if (!contenido.trim()) return contenido;
  return contenido.replace(
    /^([ \t]*(?:documento|c[ée]dula|identificaci[óo]n|cc|ti|nuip)\b[^:\n]*:[ \t]*)(.+)$/gim,
    (completo, etiqueta: string, valor: string) => {
      const canonico = canonicalizeDocumento(valor);
      // Solo se reescribe lo que se reconoce como documento. Si el modelo puso
      // prosa, una frase prudente o algo que no cuadra, la línea se deja intacta.
      if (!canonico) return completo;
      // Lo que venga DESPUÉS del documento ("…, expedida en Medellín") se
      // conserva tal cual: el campo se canoniza, no se recorta.
      const cola = valor.slice(canonico.consumido);
      return `${etiqueta}${canonico.texto}${cola}`;
    },
  );
}

/** Sección de una nota, en cualquiera de las dos formas que conviven en el repo. */
type SeccionEditable = NoteSectionLike & { content?: string; texto?: string };

/**
 * Deja el campo de identificación de una nota en su forma canónica.
 *
 * Se aplica en el borde por el que la nota entra y sale de la app
 * (`lib/api/clinical.ts`), que es el único punto por el que pasan la
 * generación, la regeneración, el ajuste del asistente y el guardado. Así lo
 * que el médico ve, lo que vuelve al backend y lo que se espeja en
 * `consultations` dicen todos lo mismo, sin que ninguna pantalla tenga que
 * reinterpretar el número.
 */
export function canonicalizeNoteIdentity<T extends { sections?: SeccionEditable[] }>(
  note: T | null | undefined,
): T | null | undefined {
  if (!note || !Array.isArray(note.sections)) return note;
  let cambio = false;
  const sections = note.sections.map((section) => {
    if (!section) return section;
    const nombre = `${section.key ?? ""} ${section.id ?? ""}`;
    if (!nombre.includes(PATIENT_IDENTITY_SECTION_KEY)) return section;
    const original = section.content ?? section.texto ?? "";
    const canonico = canonicalizeIdentitySectionText(original);
    if (canonico === original) return section;
    cambio = true;
    return section.content !== undefined
      ? { ...section, content: canonico }
      : { ...section, texto: canonico };
  });
  // Misma referencia si nada cambió: deja a React hacer bail-out en los efectos.
  return cambio ? { ...note, sections } : note;
}
