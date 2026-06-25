import type { Template } from "@/lib/mock/types";

export interface CustomClinicalTemplateRow {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  specialty_code: string;
  specialty_name: string;
  sections: string[];
  updated_at: string;
}

export const customTemplateSelect =
  "id, owner_id, name, description, specialty_code, specialty_name, sections, updated_at";

export function customTemplateToTemplate(row: CustomClinicalTemplateRow): Template {
  return {
    id: `custom:${row.id}`,
    especialidadCode: row.specialty_code,
    nombre: row.name,
    especialidad: row.specialty_name,
    creadaPor: "Tú",
    descripcion: row.description ?? undefined,
    source: "personal",
    secciones: row.sections,
    actualizada: row.updated_at,
  };
}

export function normalizeTemplateSections(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((section) => section.trim())
    .filter(Boolean)
    .slice(0, 30);
}
