/**
 * Lo que el médico ESCRIBE por sección mientras la consulta va corriendo.
 *
 * QUÉ RESUELVE
 * En una consulta real hay cosas que el médico quiere dejar en la nota y que no
 * dice en voz alta: una sospecha, una decisión, un plan que todavía está
 * pensando. Hasta ahora eso no tenía dónde vivir: si no se decía, no existía
 * para la nota.
 *
 * POR QUÉ POR SECCIÓN Y NO UNA CAJA SUELTA
 * La plantilla ya es el contrato entre esta app y el motor de notas. Colgar el
 * texto de la MISMA sección a la que pertenece quita toda ambigüedad sobre
 * dónde tiene que aterrizar, y funciona igual con cualquier plantilla porque se
 * apoya en las `key` del snapshot congelado, no en una lista fija de nombres.
 *
 * CÓMO LLEGA A LA NOTA (y por qué así)
 * El prompt de generación vive en el backend clínico y solo recibe dos cosas:
 * la transcripción y el snapshot de la plantilla. No hay un tercer canal.
 *
 * El endpoint de AJUSTE de nota sí acepta una instrucción por sección, pero no
 * sirve para esto: su prompt lleva escrito "PROHIBIDO agregar datos clínicos
 * nuevos (síntomas, hallazgos, medicamentos, diagnósticos, valores)" y "si la
 * instrucción exige inventar información, no lo hagas". Es decir, ante
 * "Sospecha de cáncer" —que es justo el caso que hay que soportar— devolvería
 * la sección intacta. Está construido para impedir exactamente esto.
 *
 * Así que las anotaciones viajan como un bloque rotulado al final de la
 * transcripción que se manda a generar. No es un parche: para el motor, la
 * transcripción es "la única materia prima", y estas frases SON materia prima
 * de la consulta —las dijo el médico, escribiéndolas—. El rótulo deja claro que
 * se escribieron y no se hablaron, así que el registro no miente sobre su
 * origen, y cada línea lleva el nombre de su sección para que el modelo la
 * lleve ahí y no contamine las demás.
 *
 * Lo limpio de verdad sería que el backend recibiera `section_inputs` como
 * campo propio y el prompt las tratara sección por sección. Cuando exista, aquí
 * solo cambia esta función. Ver docs/decisiones.md D20.
 */

import type { ClinicalTemplateSection } from "@/lib/api/clinical";

/** Texto manual por `key` de sección. Vacío = el médico no escribió nada. */
export type SectionDrafts = Record<string, string>;

/** Cabecera del bloque. Se busca literal al limpiar, así que es una constante. */
const MARCA_INICIO = "--- ANOTACIONES ESCRITAS POR EL MÉDICO DURANTE LA CONSULTA ---";

/**
 * Qué hacer con el bloque, dicho para el modelo que genera la nota.
 *
 * "No las copies tal cual como una lista aparte" es la línea que evita el
 * resultado que nadie quiere: el texto del médico pegado en bruto al final de
 * la nota en vez de redactado dentro de su sección.
 */
const INSTRUCCIONES_DEL_BLOQUE = [
  "Estas frases las escribió el médico durante la consulta; no se dijeron en voz alta.",
  "Son información explícita de la consulta: úsalas como cualquier otro dato dicho.",
  "Cada línea empieza con la sección a la que pertenece: redáctala DENTRO de esa sección, integrándola con lo que sí se habló.",
  "No las copies tal cual como una lista aparte, y no las lleves a otras secciones.",
].join(" ");

/** Deja solo las secciones con texto de verdad, sin espacios sueltos. */
export function normalizeSectionDrafts(drafts: SectionDrafts | null | undefined): SectionDrafts {
  const salida: SectionDrafts = {};
  for (const [key, valor] of Object.entries(drafts ?? {})) {
    const limpio = (valor ?? "").trim();
    if (limpio) salida[key] = limpio;
  }
  return salida;
}

/** `true` si hay al menos una anotación utilizable. */
export function hasSectionDrafts(drafts: SectionDrafts | null | undefined): boolean {
  return Object.keys(normalizeSectionDrafts(drafts)).length > 0;
}

/** Cuántas secciones llevan anotación (para el contador de la UI). */
export function countSectionDrafts(drafts: SectionDrafts | null | undefined): number {
  return Object.keys(normalizeSectionDrafts(drafts)).length;
}

/**
 * Transcripción + bloque de anotaciones, listo para generar.
 *
 * Sin anotaciones devuelve la transcripción TAL CUAL —misma cadena— para que
 * una consulta que no use esto se comporte exactamente como antes.
 *
 * El orden de las líneas es el de la plantilla, no el orden en que el médico
 * fue escribiendo: así el bloque se lee como se lee la nota.
 */
export function buildTranscriptWithSectionDrafts(
  transcript: string,
  drafts: SectionDrafts | null | undefined,
  sections: readonly ClinicalTemplateSection[] | null | undefined,
): string {
  const limpias = normalizeSectionDrafts(drafts);
  if (!Object.keys(limpias).length) return transcript;

  const ordenadas = [...(sections ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const lineas: string[] = [];
  const vistas = new Set<string>();

  for (const section of ordenadas) {
    const texto = limpias[section.key];
    if (!texto) continue;
    vistas.add(section.key);
    lineas.push(`[${section.label}] ${aparrafoUnico(texto)}`);
  }
  // Una anotación cuya sección ya no está en la plantilla no se tira a la
  // basura: se manda con su key. Pasa si la nota se regenera con otra
  // plantilla, y perder lo que el médico escribió sería lo peor que podría
  // hacer esta función.
  for (const [key, texto] of Object.entries(limpias)) {
    if (vistas.has(key)) continue;
    lineas.push(`[${key}] ${aparrafoUnico(texto)}`);
  }

  return [
    transcript.trimEnd(),
    "",
    MARCA_INICIO,
    INSTRUCCIONES_DEL_BLOQUE,
    ...lineas,
  ].join("\n");
}

/**
 * El texto del médico puede traer saltos de línea; dentro del bloque cada
 * anotación tiene que ocupar UNA línea, o se rompe el emparejado con su
 * sección.
 */
function aparrafoUnico(texto: string): string {
  return texto.replace(/\s*\n+\s*/g, " ").replace(/\s{2,}/g, " ").trim();
}

/**
 * Quita el bloque de una transcripción que ya lo tenga.
 *
 * Hace falta al REGENERAR: si no, la segunda pasada añadiría un bloque encima
 * del anterior y el médico acabaría con sus anotaciones duplicadas dentro de la
 * nota. También sirve para enseñar la transcripción limpia.
 */
export function stripSectionDraftsBlock(transcript: string): string {
  const indice = transcript.indexOf(MARCA_INICIO);
  if (indice === -1) return transcript;
  return transcript.slice(0, indice).trimEnd();
}

export const SECTION_DRAFTS_MARKER = MARCA_INICIO;
