// Lógica pura del constructor de plantillas por bloques.
//
// Aquí vive todo lo testeable sin DOM: manejo de bloques de sección
// (agregar/quitar/reordenar), validación (mínimo/máximo/duplicados/vacías),
// secciones iniciales sugeridas y armado del payload que se envía al backend
// con `POST/PUT /api/clinical/templates`.
//
// Reglas del contrato que este módulo garantiza:
// - El médico NUNCA edita `key` ni `order`: el sistema los mantiene.
// - Al editar una sección que ya existía se PRESERVA su `key` (se envía al
//   backend, que lo respeta). Los bloques nuevos van sin key y el backend la
//   genera desde el label.
// - `order` se recalcula secuencialmente según la posición visual.
// - Se envían datos limpios (labels recortados, sin vacíos) y objetos
//   `{ key?, label, order, required, instruction? }` — nunca se escribe a Supabase.

import type {
  ClinicalTemplate,
  ClinicalTemplateSection,
  ClinicalTemplateSectionInput,
  CreateClinicalTemplatePayload,
} from "@/lib/api/clinical";
import { clinicalSpecialties } from "./specialties";

export const MIN_TEMPLATE_SECTIONS = 2;
export const MAX_TEMPLATE_SECTIONS = 30;
export const MAX_LABEL_LENGTH = 90;
export const MAX_INSTRUCTION_LENGTH = 400;
export const MAX_NAME_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 400;

/**
 * Bloque de sección en el editor. `uid` es un id efímero SOLO de UI (React keys,
 * drag&drop); nunca se envía al backend. `key` existe solo si la sección viene
 * de una plantilla ya guardada y debe preservarse al editar.
 */
export interface SectionBlock {
  uid: string;
  key?: string;
  label: string;
  required: boolean;
  instruction: string;
}

let uidCounter = 0;
/** id efímero de UI, estable dentro de la sesión del editor. */
export function nextBlockUid(): string {
  uidCounter += 1;
  return `block-${uidCounter}`;
}

export function createBlock(partial?: Partial<SectionBlock>): SectionBlock {
  return {
    uid: nextBlockUid(),
    label: "",
    required: false,
    instruction: "",
    ...partial,
  };
}

/** Convierte las secciones de una plantilla del backend en bloques editables. */
export function templateToBlocks(template: ClinicalTemplate): SectionBlock[] {
  return [...(template.sections ?? [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((section) =>
      createBlock({
        key: section.key,
        label: section.label,
        required: section.required === true,
        instruction: section.instruction ?? "",
      }),
    );
}

/**
 * Bloques al DUPLICAR una plantilla ("Usar como base"): se copian labels,
 * required e instruction, pero NO las keys — la copia es una plantilla personal
 * nueva y el backend generará keys frescas.
 */
export function templateToDraftBlocks(template: ClinicalTemplate): SectionBlock[] {
  return templateToBlocks(template).map((block) =>
    createBlock({
      label: block.label,
      required: block.required,
      instruction: block.instruction,
    }),
  );
}

export function moveBlock(
  blocks: SectionBlock[],
  from: number,
  to: number,
): SectionBlock[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= blocks.length ||
    to >= blocks.length
  ) {
    return blocks;
  }
  const next = [...blocks];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function removeBlock(blocks: SectionBlock[], uid: string): SectionBlock[] {
  return blocks.filter((block) => block.uid !== uid);
}

export function updateBlock(
  blocks: SectionBlock[],
  uid: string,
  patch: Partial<Omit<SectionBlock, "uid">>,
): SectionBlock[] {
  return blocks.map((block) =>
    block.uid === uid ? { ...block, ...patch } : block,
  );
}

export interface BlockValidationResult {
  ok: boolean;
  message?: string;
  /** uids con label duplicado, para resaltarlos en la UI. */
  duplicateUids: string[];
}

/**
 * Valida los bloques con las MISMAS reglas del backend, para dar un error
 * amigable antes de enviar (el backend igual valida como última línea).
 * Detecta duplicados por `key` efectiva (snake_case del label), que es como el
 * backend detecta colisiones.
 */
export function validateBlocks(blocks: SectionBlock[]): BlockValidationResult {
  const filled = blocks.filter((block) => block.label.trim().length > 0);

  if (filled.length < MIN_TEMPLATE_SECTIONS) {
    return {
      ok: false,
      message: `Agrega mínimo ${MIN_TEMPLATE_SECTIONS} secciones con nombre.`,
      duplicateUids: [],
    };
  }
  if (filled.length > MAX_TEMPLATE_SECTIONS) {
    return {
      ok: false,
      message: `Máximo ${MAX_TEMPLATE_SECTIONS} secciones por plantilla.`,
      duplicateUids: [],
    };
  }
  if (blocks.some((block) => block.label.trim().length > MAX_LABEL_LENGTH)) {
    return {
      ok: false,
      message: `Cada sección debe tener máximo ${MAX_LABEL_LENGTH} caracteres.`,
      duplicateUids: [],
    };
  }

  // Duplicados por key efectiva (así los detecta el backend).
  const seen = new Map<string, string>();
  const duplicateUids: string[] = [];
  for (const block of filled) {
    const key = block.key?.trim() ? sectionKeyFromLabel(block.key) : sectionKeyFromLabel(block.label);
    if (seen.has(key)) {
      duplicateUids.push(block.uid, seen.get(key)!);
    } else {
      seen.set(key, block.uid);
    }
  }
  if (duplicateUids.length) {
    return {
      ok: false,
      message: "Hay secciones con nombres repetidos. Usa nombres distintos.",
      duplicateUids: [...new Set(duplicateUids)],
    };
  }

  return { ok: true, duplicateUids: [] };
}

/** Reproduce toSnakeKey del backend, para detectar duplicados igual que él. */
export function sectionKeyFromLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export interface BuildPayloadInput {
  name: string;
  specialtyCode: string;
  description?: string;
  blocks: SectionBlock[];
}

/**
 * Arma el payload para `POST/PUT /api/clinical/templates`. Recorta labels e
 * instrucciones, descarta bloques sin nombre, recalcula `order` por posición y
 * preserva `key` donde exista (edición). Instrucción vacía se omite (el backend
 * genera una por defecto).
 */
export function buildTemplatePayload(
  input: BuildPayloadInput,
): CreateClinicalTemplatePayload {
  const sections = input.blocks
    .map((block) => ({
      key: block.key?.trim() || undefined,
      label: block.label.trim(),
      required: block.required,
      instruction: block.instruction.trim(),
    }))
    .filter((section) => section.label.length > 0)
    .map((section, index) => {
      const payloadSection: ClinicalTemplateSectionInput = {
        label: section.label,
        order: index + 1,
        required: section.required,
      };
      if (section.key) payloadSection.key = section.key;
      if (section.instruction) payloadSection.instruction = section.instruction;
      return payloadSection;
    });

  return {
    name: input.name.trim(),
    specialty: input.specialtyCode,
    description: input.description?.trim() || undefined,
    sections,
  };
}

/** Secciones iniciales sugeridas al crear desde cero, según la especialidad. */
export function starterBlocksForSpecialty(specialtyCode: string): SectionBlock[] {
  const specialty = clinicalSpecialties.find(
    (item) => item.code === specialtyCode,
  );
  const focusLabel = specialty ? capitalize(specialty.focus) : "Enfermedad actual";
  const labels: { label: string; required: boolean }[] = [
    { label: "Motivo de consulta", required: true },
    { label: "Enfermedad actual", required: true },
    { label: focusLabel, required: false },
    { label: "Antecedentes relevantes", required: false },
    { label: "Examen físico dirigido", required: false },
    { label: "Impresión diagnóstica", required: true },
    { label: "Plan y recomendaciones", required: true },
  ];
  // Evita duplicar el bloque de foco si coincide con uno estándar.
  const seen = new Set<string>();
  return labels
    .filter((item) => {
      const key = sectionKeyFromLabel(item.label);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item) => createBlock({ label: item.label, required: item.required }));
}

function capitalize(value: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : trimmed;
}

/** Secciones ordenadas por `order` (helper de solo lectura para previews). */
export function orderedSections(
  sections: ClinicalTemplateSection[] | undefined,
): ClinicalTemplateSection[] {
  return [...(sections ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
