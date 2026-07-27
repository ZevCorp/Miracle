/**
 * Extrae CONCEPTOS CANÓNICOS de la nota clínica: `vital.talla`, `vital.peso`,
 * `paciente.edad`… Es la mitad de servidor de una idea sencilla — el portal oye al
 * médico y produce conceptos; el agente de escritorio los coloca en los campos de
 * SAP con el mapeo que aprendió por pantalla.
 *
 * POR QUÉ CONCEPTOS Y NO CAMPOS: los conceptos son estables y las pantallas no. Si
 * este archivo supiera de `RNPA10-TALLA` quedaría atado a una versión de una
 * transacción de un hospital; sabiendo solo «talla en metros» sirve para cualquier
 * destino, y el acoplamiento vive donde debe — en el cliente que ve la pantalla.
 *
 * POR QUÉ NO UN LLM: la nota cambia mientras el médico dicta. Un modelo por cambio
 * son cientos de llamadas y varios segundos cada una; aquí se necesita que el valor
 * aparezca en el campo mientras el paciente sigue hablando. La nota además NO es
 * habla cruda: ya la organizó el Product-LLM en secciones, así que viene bastante
 * regular. Lo que sí exige el terreno clínico es no equivocarse:
 *
 *   1. Todo patrón está ANCLADO A SU ETIQUETA («talla», «TA», «FC»…). Nunca se toma
 *      un número suelto: «57» solo es peso si dice peso.
 *   2. Todo valor pasa por un RANGO PLAUSIBLE. Una temperatura de 896 no es una
 *      temperatura — es una frecuencia cardíaca mal leída, y en la pantalla real de
 *      pruebas de hoy ese 896 estaba escrito en «Frec. Cardíaca».
 *   3. Lo dudoso NO SE DEVUELVE. Un campo vacío lo llena el médico en dos segundos;
 *      uno con el número equivocado puede no verlo nadie.
 */

import type { NoteSection } from "@/lib/mock/types";

/** Llave canónica de un dato clínico. Es el contrato con el agente de escritorio. */
export type ConceptKey =
  | "paciente.edad"
  | "vital.talla"
  | "vital.peso"
  | "vital.presion.sistolica"
  | "vital.presion.diastolica"
  | "vital.frecuencia.cardiaca"
  | "vital.frecuencia.respiratoria"
  | "vital.temperatura"
  | "vital.saturacion";

export interface ConceptValue {
  /** Ya formateado como texto: es lo que se teclea en el campo destino. */
  value: string;
  /** El fragmento de la nota que lo justifica. Sin esto no hay forma de auditar. */
  evidence: string;
}

export type ConceptMap = Partial<Record<ConceptKey, ConceptValue>>;

interface Rule {
  key: ConceptKey;
  /** El grupo 1 debe capturar el número. */
  pattern: RegExp;
  min: number;
  max: number;
  /** Decimales a conservar; 0 = entero. */
  decimals: number;
}

// Fragmentos reutilizables. `[^.\n]{0,12}` permite el ruido entre la etiqueta y el
// número («talla de 1.70», «FC: 88 x min») sin cruzar a la frase siguiente — el
// punto y el salto de línea son la frontera, o «peso 57. Temperatura 36» dejaría que
// una etiqueta capturase el número de la otra.
const GAP = "[^.\\n]{0,12}?";
const NUM = "(\\d{1,3}(?:[.,]\\d{1,2})?)";

const RULES: readonly Rule[] = [
  // La talla se dicta en metros («1.70») o en centímetros («170»). Se aceptan las
  // dos y se normaliza a metros: el rango las separa sin ambigüedad posible.
  { key: "vital.talla", pattern: new RegExp(`\\b(?:talla|estatura)\\b${GAP}${NUM}`, "i"), min: 0.4, max: 2.6, decimals: 2 },
  { key: "vital.peso", pattern: new RegExp(`\\bpeso\\b${GAP}${NUM}`, "i"), min: 0.5, max: 400, decimals: 1 },

  { key: "vital.frecuencia.cardiaca", pattern: new RegExp(`\\b(?:frecuencia\\s+card[ií]aca|f\\.?\\s?c\\.?|pulso)\\b${GAP}${NUM}`, "i"), min: 20, max: 250, decimals: 0 },
  { key: "vital.frecuencia.respiratoria", pattern: new RegExp(`\\b(?:frecuencia\\s+respiratoria|f\\.?\\s?r\\.?)\\b${GAP}${NUM}`, "i"), min: 4, max: 80, decimals: 0 },
  { key: "vital.temperatura", pattern: new RegExp(`\\b(?:temperatura|temp\\.?)\\b${GAP}${NUM}`, "i"), min: 30, max: 43, decimals: 1 },
  { key: "vital.saturacion", pattern: new RegExp(`\\b(?:saturaci[oó]n(?:\\s+de\\s+ox[ií]geno)?|sat\\.?\\s?o2|spo2)\\b${GAP}${NUM}`, "i"), min: 40, max: 100, decimals: 0 },

  // La edad va anclada por la UNIDAD y no por una etiqueta previa, porque casi nunca
  // se dice «edad»: se dice «paciente de 68 años». El ancla es el «años» de después.
  { key: "paciente.edad", pattern: new RegExp(`${NUM}\\s*a[nñ]os?\\b`, "i"), min: 0, max: 120, decimals: 0 },
];

// La presión va aparte: son DOS números en una sola expresión y hay que leerlos
// juntos o no leerlos. «120 sobre 80» y «120/80» son la misma frase dictada de dos
// maneras. Tomar solo uno de los dos sería peor que no tomar ninguno.
// «TA» entra como abreviatura porque es como se dicta de verdad. Es corta y podría
// dar falsos positivos sola, pero aquí no puede: detrás tiene que venir el par
// número/número, que ninguna otra cosa escribe así.
const BLOOD_PRESSURE = new RegExp(
  `\\b(?:t\\.?\\s?a\\.?|tensi[oó]n|presi[oó]n)(?:\\s+arterial)?\\b${GAP}(\\d{2,3})\\s*(?:\\/|sobre)\\s*(\\d{2,3})`,
  "i",
);

/** Texto plano de la nota: títulos fuera, contenido dentro. */
export function noteToText(sections: readonly NoteSection[] | null | undefined): string {
  if (!Array.isArray(sections)) return "";
  // Se filtran los trozos vacíos ANTES de unir, no después: una sección que solo
  // trae items dejaría una línea en blanco al frente, y esa línea vacía es
  // precisamente lo que separa frases para los patrones anclados.
  return sections
    .flatMap((s) => [s?.texto ?? "", ...(Array.isArray(s?.items) ? s.items : [])])
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter((t) => t.length > 0)
    .join("\n");
}

function format(raw: string, rule: Rule): { value: number; text: string } | null {
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n)) return null;

  // Talla dictada en centímetros: 170 → 1.70. Solo aquí, y solo con un valor que no
  // puede ser metros; cualquier otra conversión implícita sería adivinar.
  let value = n;
  if (rule.key === "vital.talla" && n >= 40 && n <= 260) value = n / 100;

  if (value < rule.min || value > rule.max) return null;
  return { value, text: rule.decimals === 0 ? String(Math.round(value)) : value.toFixed(rule.decimals) };
}

/** Recorta la frase alrededor del hallazgo, para que la evidencia sea legible. */
function around(text: string, index: number, length: number): string {
  const from = Math.max(0, index - 24);
  const to = Math.min(text.length, index + length + 16);
  return text.slice(from, to).replace(/\s+/g, " ").trim();
}

/**
 * Lee la nota y devuelve solo los conceptos que se pueden afirmar. Lo que no encaje
 * en su rango, o no traiga etiqueta, sencillamente no sale.
 */
export function extractConcepts(
  sections: readonly NoteSection[] | null | undefined,
): ConceptMap {
  const text = noteToText(sections);
  if (!text.trim()) return {};

  const out: ConceptMap = {};

  for (const rule of RULES) {
    const m = rule.pattern.exec(text);
    if (!m || typeof m[1] !== "string") continue;
    const parsed = format(m[1], rule);
    if (!parsed) continue;
    out[rule.key] = { value: parsed.text, evidence: around(text, m.index, m[0].length) };
  }

  const bp = BLOOD_PRESSURE.exec(text);
  if (bp) {
    const sys = Number(bp[1]);
    const dia = Number(bp[2]);
    // La sistólica es mayor que la diastólica, siempre. Si vienen al revés no es que
    // el paciente sea raro: es que se leyó mal, y entonces no se devuelve ninguna.
    if (sys > dia && sys >= 50 && sys <= 300 && dia >= 20 && dia <= 200) {
      const evidence = around(text, bp.index, bp[0].length);
      out["vital.presion.sistolica"] = { value: String(sys), evidence };
      out["vital.presion.diastolica"] = { value: String(dia), evidence };
    }
  }

  return out;
}

/**
 * Huella del conjunto de conceptos. El agente sondea seguido; con esto compara un
 * string corto en vez de todo el mapa, y solo escribe cuando algo cambió de verdad.
 */
export function conceptsRevision(concepts: ConceptMap): string {
  const parts = Object.keys(concepts)
    .sort()
    .map((k) => `${k}=${concepts[k as ConceptKey]?.value ?? ""}`);
  if (parts.length === 0) return "0";

  // FNV-1a: corto, estable entre procesos y sin dependencias. No es criptografía —
  // solo tiene que cambiar cuando cambia el contenido.
  let h = 0x811c9dc5;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${parts.length}:${(h >>> 0).toString(16)}`;
}
