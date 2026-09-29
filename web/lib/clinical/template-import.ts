// Lógica pura de "trae tu plantilla": clasificar lo que suelta el médico,
// medir el lote y sanear lo que devuelve el modelo.
//
// Este módulo lo importan LOS DOS lados —la ruta de servidor
// `app/api/clinical/template-from-image` y el diálogo de cliente— así que no
// puede tocar el DOM ni importar `medical-areas.ts`, que arrastra iconos de
// `lucide-react` al bundle del servidor.
//
// PROTECCIÓN DE DATOS: de una foto solo se extraen los RÓTULOS de las secciones,
// nunca lo escrito encima. Eso lo pide el prompt y lo acota este saneador:
// labels cortos, tope de secciones y ningún campo de contenido libre.

import type { CreateClinicalTemplatePayload } from "@/lib/api/clinical";
import { MAX_SNIPPET_FILE_BYTES, validateSnippetFile } from "./file-to-text";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_INSTRUCTION_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_NAME_LENGTH,
  MAX_TEMPLATE_SECTIONS,
  MIN_TEMPLATE_SECTIONS,
  sectionKeyFromLabel,
} from "./template-builder";

/** Una plantilla de papel suele tener dos caras; cuatro cubre las de tres hojas. */
export const MAX_IMPORT_IMAGES = 4;
export const MAX_IMPORT_DOCUMENTS = 3;

/**
 * Presupuesto POR imagen, en caracteres del data URL (= bytes de body).
 *
 * Fijo, no `TOTAL / n`: si dependiera de cuántas fotos hay, añadir o quitar una
 * obligaría a recomprimir todas las demás.
 */
export const TEMPLATE_IMAGE_CHARS = 900_000;
/** Presupuesto agregado. El límite de body de la plataforma son 4.5 MB. */
export const TEMPLATE_IMAGE_TOTAL_CHARS =
  TEMPLATE_IMAGE_CHARS * MAX_IMPORT_IMAGES;
/** Anthropic reescala por encima de 1568 px: subir más es pagar bytes por nada. */
export const TEMPLATE_IMAGE_MAX_EDGE = 1568;

/** El mismo tope que tenía el textarea del diálogo anterior. */
export const MAX_PASTED_EXAMPLE_CHARS = 12_000;
/** Texto que acompaña a las fotos dentro de la misma llamada de visión. */
export const MAX_IMAGE_NOTES_CHARS = 4_000;

const IMAGE_MIME = /^image\/(jpeg|png|webp)$/i;
const IMAGE_EXTENSION = /\.(jpe?g|png|webp)$/i;
/** Espejo de MAX_SOURCE_IMAGE_BYTES en lib/images/compress. */
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export type ImportKind = "image" | "document";

export interface ImportItem {
  tempId: string;
  kind: ImportKind;
  name: string;
  /** Imagen → data URL ya comprimido. Documento → texto extraído. */
  payload: string;
  error?: string;
}

export interface ProposalSection {
  label: string;
  required: boolean;
  instruction?: string;
}

export interface TemplateProposal {
  name: string;
  description?: string;
  sections: ProposalSection[];
}

export type ClassifyResult = { kind: ImportKind } | { error: string };

/**
 * Qué es lo que acaba de soltar el médico. Las imágenes se validan aquí; los
 * documentos delegan en `validateSnippetFile`, que ya sabe explicar el `.doc`
 * antiguo y el archivo vacío.
 */
export function classifyImportFile(
  file: Pick<File, "name" | "type" | "size">,
): ClassifyResult {
  const isImage = IMAGE_MIME.test(file.type) || IMAGE_EXTENSION.test(file.name);
  if (isImage) {
    if (!file.size) return { error: "El archivo está vacío." };
    if (file.size > MAX_IMAGE_BYTES) {
      return { error: "La foto supera 15 MB. Tómala con menos resolución." };
    }
    return { kind: "image" };
  }
  // El PDF es el "casi" más frecuente: merece una salida, no un rechazo seco.
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    return {
      error:
        "Los PDF todavía no se leen. Toma una foto de la página o pega el texto.",
    };
  }
  // El tope de tamaño se comprueba antes de delegar: `validateSnippetFile` lo
  // explica hablando de atajos ("los atajos son textos cortos"), que es otra
  // funcionalidad y no le dice nada a quien está subiendo su plantilla.
  if (file.size > MAX_SNIPPET_FILE_BYTES) {
    return {
      error: "El archivo supera 2 MB. Si trae logos o imágenes, pega el texto.",
    };
  }
  const invalid = validateSnippetFile(file);
  if (invalid) return { error: invalid };
  return { kind: "document" };
}

/** Mensaje en español, o null si el lote se puede enviar. */
export function validateImportBatch(
  items: readonly ImportItem[],
  pastedText: string,
): string | null {
  const usable = items.filter((item) => !item.error);
  const images = usable.filter((item) => item.kind === "image");
  const documents = usable.filter((item) => item.kind === "document");
  const text = pastedText.trim();

  if (!images.length && !documents.length && !text) {
    return "Añade una foto, un archivo o pega el texto de tu plantilla.";
  }
  if (images.length > MAX_IMPORT_IMAGES) {
    return `Puedes subir hasta ${MAX_IMPORT_IMAGES} fotos a la vez.`;
  }
  if (documents.length > MAX_IMPORT_DOCUMENTS) {
    return `Puedes subir hasta ${MAX_IMPORT_DOCUMENTS} archivos a la vez.`;
  }
  if (text.length > MAX_PASTED_EXAMPLE_CHARS) {
    return `El texto pegado supera ${MAX_PASTED_EXAMPLE_CHARS} caracteres. Recorta lo que no sea la estructura.`;
  }
  const chars = images.reduce((total, item) => total + item.payload.length, 0);
  if (chars > TEMPLATE_IMAGE_TOTAL_CHARS) {
    return "Las fotos pesan demasiado juntas. Quita una o tómalas con menos resolución.";
  }
  return null;
}

/**
 * Documentos y texto pegado en un solo ejemplo. Cada archivo va con su nombre
 * delante para que el modelo no funda dos formularios distintos en uno.
 */
export function mergeTextSources(
  items: readonly ImportItem[],
  pastedText: string,
): string {
  const partes = items
    .filter(
      (item) => item.kind === "document" && !item.error && item.payload.trim(),
    )
    .map((item) => `--- ${item.name} ---\n${item.payload.trim()}`);
  const pegado = pastedText.trim();
  if (pegado) partes.push(pegado);
  return partes.join("\n\n");
}

function cleanLine(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Sanea lo que devuelve el modelo, tan defensivamente como `sanitizeCitas` en
 * `parse-schedule`: nada de lo que llega se da por bueno por su forma.
 *
 * Deduplica por `sectionKeyFromLabel` —la misma regla con la que
 * `validateBlocks` detecta colisiones— porque si no, el borrador abriría el
 * constructor ya en un estado que se negará a guardarse, sin que el médico
 * entienda por qué.
 *
 * Devuelve null si no sobreviven MIN_TEMPLATE_SECTIONS secciones. El corte va
 * aquí y no más adelante: `ensurePatientIdentityBlock` antepone la casilla de
 * identificación y colaría una plantilla con una sola sección útil.
 */
export function sanitizeTemplateProposal(
  value: unknown,
  options: { fallbackName?: string } = {},
): TemplateProposal | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const list = raw.sections;
  if (!Array.isArray(list)) return null;

  const sections: ProposalSection[] = [];
  const seen = new Set<string>();
  for (const entry of list) {
    if (sections.length >= MAX_TEMPLATE_SECTIONS) break;
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const label = cleanLine(item.label, MAX_LABEL_LENGTH);
    if (!label) continue;
    const key = sectionKeyFromLabel(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const instruction = cleanLine(item.instruction, MAX_INSTRUCTION_LENGTH);
    sections.push({
      label,
      // Solo el booleano exacto: "sí", 1 o "true" no son una decisión clínica.
      required: item.required === true,
      ...(instruction ? { instruction } : {}),
    });
  }
  if (sections.length < MIN_TEMPLATE_SECTIONS) return null;

  const name =
    cleanLine(raw.name, MAX_NAME_LENGTH) ||
    options.fallbackName?.slice(0, MAX_NAME_LENGTH) ||
    "Plantilla importada";
  const description = cleanLine(raw.description, MAX_DESCRIPTION_LENGTH);

  return { name, sections, ...(description ? { description } : {}) };
}

/**
 * Punto donde los dos caminos —fotos y texto— convergen en el mismo borrador
 * que abre el constructor.
 */
export function proposalToDraft(
  proposal: TemplateProposal,
  specialtyCode: string,
): CreateClinicalTemplatePayload {
  return {
    name: proposal.name,
    specialty: specialtyCode,
    ...(proposal.description ? { description: proposal.description } : {}),
    sections: proposal.sections.map((section, index) => ({
      label: section.label,
      order: index + 1,
      required: section.required,
      ...(section.instruction ? { instruction: section.instruction } : {}),
    })),
  };
}
