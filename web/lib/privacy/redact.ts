import type { ClinicalNoteJson } from "@/lib/api/clinical";

/**
 * Capa de de-identificación (PHI) previa al envío a la IA.
 *
 * La transcripción y las instrucciones al asistente se redactan ANTES de salir
 * hacia el backend Miracle (y por lo tanto hacia el LLM): el nombre del
 * paciente registrado se reemplaza por [PACIENTE], su documento por
 * [DOCUMENTO] y cualquier secuencia de 7–10 dígitos por [NUMERO]. La nota que
 * devuelve la IA se rehidrata ([PACIENTE]/[DOCUMENTO] → datos reales) para que
 * la historia clínica quede completa; [NUMERO] no tiene inversa y queda
 * visible para que el médico lo corrija si hace falta.
 *
 * Limitaciones conocidas (decisiones de alcance, no bugs):
 * - Números dictados en palabras ("cuarenta y tres, veintiocho…") no se
 *   detectan; solo se capturan si el STT los emite como dígitos.
 * - Nombres de terceros (familiares, otros médicos) no se tapan: solo el
 *   paciente registrado es identificable de forma confiable.
 * - El audio viaja del navegador al proveedor STT antes de existir texto que
 *   redactar: esta capa protege al LLM/backend, no al STT.
 * - Apellidos que son palabras comunes ("Rosa", "Cruz") se redactan en
 *   cualquier uso; números largos no-cédula caen en [NUMERO]. Es
 *   sobre-protección visible y editable, nunca una fuga.
 * - Tokens del nombre con menos de 3 caracteres ("Li", "Wu") no se redactan
 *   sueltos; el nombre completo como frase sí.
 */

export const PLACEHOLDER_PACIENTE = "[PACIENTE]";
export const PLACEHOLDER_DOCUMENTO = "[DOCUMENTO]";
export const PLACEHOLDER_NUMERO = "[NUMERO]";

// Interruptor temporal (pedido explícito, 2026-07-21): los médicos necesitan
// ver el texto tal como se dictó -incluida la cédula y cualquier otro número-
// para poder verificar que la nota quedó correcta contra la transcripción. El
// [NUMERO] genérico nunca se rehidrata (es irreversible por diseño), así que
// mientras esto estuvo activo esos números quedaban perdidos para siempre en
// la transcripción que el médico revisa. Se apaga aquí (un solo interruptor
// para las 3 pantallas que llaman a buildRedactor) sin borrar el motor: los
// tests siguen cubriendo la lógica real pasando `enabled: true` explícito, y
// se reactiva cambiando este valor cuando haya una forma de mostrar el dato
// real sin perder la protección hacia el LLM.
const REDACTION_ENABLED = false;

export interface RedactorIdentity {
  nombre?: string | null;
  documento?: string | null;
}

export interface Redactor {
  /** true si hay nombre o documento utilizables (para el badge de UI). */
  hasIdentity: boolean;
  redact(text: string): string;
  rehydrate(text: string): string;
  redactNote(note: ClinicalNoteJson): ClinicalNoteJson;
  rehydrateNote(note: ClinicalNoteJson): ClinicalNoteJson;
}

/* ------------------------------------------------------------------ */
/* Utilidades internas                                                 */
/* ------------------------------------------------------------------ */

// Partición que conserva los placeholders como segmentos propios: cada pase
// procesa solo los tramos que aún no son placeholders (idempotencia y cero
// riesgo de corromper un placeholder ya insertado).
const PLACEHOLDER_SPLIT = /(\[(?:PACIENTE|DOCUMENTO|NUMERO)\])/;
const PLACEHOLDER_EXACT = /^\[(?:PACIENTE|DOCUMENTO|NUMERO)\]$/;

// Partículas de nombres compuestos: no se redactan sueltas ("María del
// Carmen" no debe tapar cada "del" del dictado), pero sí puentean el colapso
// de placeholders contiguos.
const NAME_PARTICLES = [
  "de",
  "del",
  "la",
  "las",
  "los",
  "da",
  "dos",
  "san",
  "santa",
  "van",
  "von",
  "y",
  "e",
];
const PARTICLE_SET = new Set(NAME_PARTICLES);

// "José David [PACIENTE]…" → colapsa secuencias de [PACIENTE] unidas por
// espacios o partículas en un único placeholder. Garantiza que
// redact(rehydrate(x)) === x aunque el nombre tenga partículas.
const COLLAPSE_PACIENTE = new RegExp(
  `\\[PACIENTE\\](?:(?:\\s+(?:${NAME_PARTICLES.join("|")}))*\\s+\\[PACIENTE\\])+`,
  "giu",
);

// Insensibilidad a acentos sin depender de normalizar el texto de entrada
// (los índices deben corresponder al texto original).
const ACCENT_CLASSES: Record<string, string> = {
  a: "[aáàâäã]",
  e: "[eéèêë]",
  i: "[iíìîï]",
  o: "[oóòôöõ]",
  u: "[uúùûü]",
  n: "[nñ]",
  c: "[cç]",
};

// Límites de palabra Unicode. Nunca usar \b: en JS es ASCII y /José\b/ no
// matchea "José " (la é no cuenta como \w).
const NOT_WORD_BEFORE = "(?<![\\p{L}\\p{N}])";
const NOT_WORD_AFTER = "(?![\\p{L}\\p{N}])";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Minúsculas sin diacríticos ("José" → "jose") para construir patrones. */
function normalizeToken(token: string): string {
  return token
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

/** Patrón insensible a acentos/mayúsculas para un token normalizado. */
function tokenToPattern(token: string): string {
  return Array.from(token)
    .map((ch) => ACCENT_CLASSES[ch] ?? escapeRegExp(ch))
    .join("");
}

/** Aplica fn solo a los tramos del texto que no son placeholders. */
function mapOutsidePlaceholders(
  text: string,
  fn: (chunk: string) => string,
): string {
  if (!text.includes("[")) return fn(text);
  return text
    .split(PLACEHOLDER_SPLIT)
    .map((part) => (PLACEHOLDER_EXACT.test(part) ? part : fn(part)))
    .join("");
}

/* ------------------------------------------------------------------ */
/* Construcción de patrones por identidad                              */
/* ------------------------------------------------------------------ */

/**
 * Regex del documento registrado: la cadena literal tal como se registró
 * ("CC 1.023.456.789") o sus dígitos con separadores opcionales
 * (1023456789 / 1.023.456.789 / 1 023 456 789). Solo si tiene ≥6 dígitos,
 * para descartar valores tipo "Por registrar".
 */
function buildDocumentoRegex(documento: string | null | undefined): {
  regex: RegExp | null;
  literal: string | null;
} {
  const literal = documento?.trim() ?? "";
  const digits = literal.replace(/\D/g, "");
  if (digits.length < 6) return { regex: null, literal: null };
  const spaced = digits.split("").join("[.\\s-]?");
  const alternatives = [`(?<!\\d)${spaced}(?!\\d)`];
  if (literal !== digits) {
    alternatives.unshift(
      `${NOT_WORD_BEFORE}${escapeRegExp(literal)}${NOT_WORD_AFTER}`,
    );
  }
  return { regex: new RegExp(alternatives.join("|"), "giu"), literal };
}

/**
 * Regex del nombre registrado: primero el nombre completo como frase (cubre
 * partículas y tokens cortos), luego cada token utilizable suelto ("don
 * José", "vino Jaramillo"). Tokens utilizables: ≥3 caracteres y fuera de la
 * lista de partículas.
 */
function buildNombreRegex(nombre: string | null | undefined): {
  regex: RegExp | null;
  literal: string | null;
} {
  const literal = nombre?.trim() ?? "";
  if (!literal) return { regex: null, literal: null };
  const rawTokens = literal.split(/\s+/);
  const normalized = rawTokens.map(normalizeToken).filter(Boolean);
  const usable = [
    ...new Set(
      normalized.filter(
        (token) => token.length >= 3 && !PARTICLE_SET.has(token),
      ),
    ),
  ];
  if (usable.length === 0) return { regex: null, literal: null };

  const alternatives: string[] = [];
  if (normalized.length > 1) {
    alternatives.push(normalized.map(tokenToPattern).join("\\s+"));
  }
  // Más largos primero: si un token es prefijo de otro ("ana"/"anabel"),
  // gana el largo.
  for (const token of [...usable].sort((a, b) => b.length - a.length)) {
    alternatives.push(tokenToPattern(token));
  }
  const body = alternatives.map((alt) => `(?:${alt})`).join("|");
  return {
    regex: new RegExp(`${NOT_WORD_BEFORE}(?:${body})${NOT_WORD_AFTER}`, "giu"),
    literal,
  };
}

// Cédulas agrupadas ("1.023.456.789"); solo si el total de dígitos está en
// 7–10 (deja intactos valores clínicos como "250.000" plaquetas).
const GROUPED_DIGITS = /(?<!\d)\d{1,3}(?:\.\d{3}){2,3}(?!\d)/g;
// Corridas contiguas de 7–10 dígitos (cédulas dictadas sin separadores).
const PLAIN_DIGITS = /(?<!\d)\d{7,10}(?!\d)/g;

function redactGenericNumbers(chunk: string): string {
  return chunk
    .replace(GROUPED_DIGITS, (match) => {
      const digits = match.replace(/\D/g, "");
      return digits.length >= 7 && digits.length <= 10
        ? PLACEHOLDER_NUMERO
        : match;
    })
    .replace(PLAIN_DIGITS, PLACEHOLDER_NUMERO);
}

/* ------------------------------------------------------------------ */
/* Recorrido del note_json                                             */
/* ------------------------------------------------------------------ */

// Identificadores estructurales de la nota: mutarlos rompería el mapeo de
// secciones (updateNoteSectionContent, noteJsonToSections).
const EXCLUDED_NOTE_KEYS = new Set(["key", "missing_required_sections"]);

function transformValue(value: unknown, fn: (text: string) => string): unknown {
  if (typeof value === "string") {
    const next = fn(value);
    return next === value ? value : next;
  }
  if (Array.isArray(value)) {
    let changed = false;
    const mapped = value.map((item) => {
      const next = transformValue(item, fn);
      if (next !== item) changed = true;
      return next;
    });
    return changed ? mapped : value;
  }
  if (value && typeof value === "object") {
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (EXCLUDED_NOTE_KEYS.has(key)) {
        out[key] = item;
        continue;
      }
      const next = transformValue(item, fn);
      if (next !== item) changed = true;
      out[key] = next;
    }
    return changed ? out : value;
  }
  return value;
}

/**
 * Aplica fn a todos los strings de la nota (summary, sections[].content,
 * discharge.*, warnings, campos futuros) excepto los identificadores de
 * sección. Devuelve la MISMA referencia si nada cambió (permite a React
 * hacer bail-out en los efectos de rehidratación).
 */
export function transformNoteStrings(
  note: ClinicalNoteJson,
  fn: (text: string) => string,
): ClinicalNoteJson {
  return transformValue(note, fn) as ClinicalNoteJson;
}

/* ------------------------------------------------------------------ */
/* API principal                                                       */
/* ------------------------------------------------------------------ */

export function buildRedactor(
  identity?: RedactorIdentity | null,
  enabled: boolean = REDACTION_ENABLED,
): Redactor {
  const nombre = buildNombreRegex(identity?.nombre);
  const documento = buildDocumentoRegex(identity?.documento);

  if (!enabled) {
    const passthrough = (text: string) => text;
    return {
      hasIdentity: Boolean(nombre.regex || documento.regex),
      redact: passthrough,
      rehydrate: passthrough,
      redactNote: (note) => note,
      rehydrateNote: (note) => note,
    };
  }

  function redact(text: string): string {
    if (!text) return text;
    let out = text;
    // El documento registrado va antes que los números genéricos para que
    // termine en [DOCUMENTO] (rehidratable) y no en [NUMERO].
    if (documento.regex) {
      out = mapOutsidePlaceholders(out, (chunk) =>
        chunk.replace(documento.regex!, PLACEHOLDER_DOCUMENTO),
      );
    }
    out = mapOutsidePlaceholders(out, redactGenericNumbers);
    if (nombre.regex) {
      out = mapOutsidePlaceholders(out, (chunk) =>
        chunk.replace(nombre.regex!, PLACEHOLDER_PACIENTE),
      );
      out = out.replace(COLLAPSE_PACIENTE, PLACEHOLDER_PACIENTE);
    }
    return out;
  }

  function rehydrate(text: string): string {
    if (!text) return text;
    let out = text;
    // Solo se rehidrata lo que redact() puede volver a tapar: mantiene
    // estable el ciclo redactar → rehidratar → redactar.
    if (nombre.literal) {
      out = out.split(PLACEHOLDER_PACIENTE).join(nombre.literal);
    }
    if (documento.literal) {
      out = out.split(PLACEHOLDER_DOCUMENTO).join(documento.literal);
    }
    return out;
  }

  return {
    hasIdentity: Boolean(nombre.regex || documento.regex),
    redact,
    rehydrate,
    redactNote: (note) => transformNoteStrings(note, redact),
    rehydrateNote: (note) => transformNoteStrings(note, rehydrate),
  };
}
