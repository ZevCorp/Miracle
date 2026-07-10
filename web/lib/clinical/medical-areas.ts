// Áreas médicas — SOLO metadata de presentación para navegar el catálogo.
//
// Por qué existe este archivo:
// - El backend clínico (/api/clinical/templates) es la fuente oficial de
//   plantillas. NO devuelve "área médica"; solo `specialty` (snake_case).
// - `lib/clinical/specialties.ts` tiene 49 especialidades con un `group` amplio
//   (Clínica/Quirúrgica/…), pero "Clínica" agrupa 25 especialidades: demasiadas
//   para una navegación cómoda.
// - Este archivo agrupa las 49 especialidades en áreas clínicas navegables
//   (Área → Especialidad → Plantillas). Es la ÚNICA fuente de esa agrupación.
//
// Reglas:
// - No contiene plantillas ni las duplica: solo clasifica especialidades.
// - La clave es el `specialty_code` (forma con guiones de specialties.ts); las
//   búsquedas normalizan guiones/guion_bajo/acentos, así que también casa con la
//   forma del backend (`medicina_general`).
// - Si en el futuro el backend expone el área, migrar a esa fuente y borrar este
//   archivo (ver docs/medical-areas-backend-proposal.md).

import {
  Baby,
  Brain,
  HeartPulse,
  Microscope,
  Scale,
  Scissors,
  Siren,
  Smile,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { clinicalSpecialties, type ClinicalSpecialty } from "./specialties";

export interface MedicalArea {
  code: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** specialty_code (forma con guiones, como en specialties.ts). */
  specialtyCodes: string[];
}

/**
 * Normaliza un specialty_code para comparar sin importar guiones vs guion_bajo
 * ni acentos: "medicina-general" == "medicina_general" == "Medicina General".
 */
export function normalizeSpecialtyKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Agrupación canónica (49 especialidades → 9 áreas). Cada especialidad aparece
// en exactamente un área; hay una verificación de cobertura en los tests.
export const medicalAreas: MedicalArea[] = [
  {
    code: "medicina-clinica",
    name: "Medicina clínica",
    description: "Atención médica del adulto y subespecialidades clínicas.",
    icon: Stethoscope,
    specialtyCodes: [
      "medicina-general",
      "medicina-familiar",
      "medicina-interna",
      "geriatria",
      "cardiologia",
      "dermatologia",
      "endocrinologia",
      "gastroenterologia",
      "hematologia",
      "infectologia",
      "nefrologia",
      "neumologia",
      "neurologia",
      "oncologia",
      "reumatologia",
      "alergologia",
    ],
  },
  {
    code: "materno-infantil",
    name: "Salud materno-infantil",
    description: "Cuidado del niño, el recién nacido y la salud de la mujer.",
    icon: Baby,
    specialtyCodes: [
      "pediatria",
      "neonatologia",
      "ginecologia-obstetricia",
      "cirugia-pediatrica",
    ],
  },
  {
    code: "urgencias-critico",
    name: "Urgencias y cuidado crítico",
    description: "Atención inicial de urgencias y manejo perioperatorio.",
    icon: Siren,
    specialtyCodes: ["urgencias", "anestesiologia"],
  },
  {
    code: "quirurgicas",
    name: "Especialidades quirúrgicas",
    description: "Valoración y procedimientos quirúrgicos por especialidad.",
    icon: Scissors,
    specialtyCodes: [
      "cirugia-general",
      "cirugia-cardiovascular",
      "cirugia-torax",
      "cirugia-vascular",
      "neurocirugia",
      "cirugia-plastica",
      "coloproctologia",
      "ortopedia",
      "oftalmologia",
      "otorrinolaringologia",
      "urologia",
      "cirugia-maxilofacial",
    ],
  },
  {
    code: "salud-mental",
    name: "Salud mental",
    description: "Valoración y seguimiento en psiquiatría y psicología.",
    icon: Brain,
    specialtyCodes: ["psiquiatria", "psicologia"],
  },
  {
    code: "diagnostico-apoyo",
    name: "Diagnóstico y apoyo terapéutico",
    description: "Imágenes, laboratorio, patología y genética.",
    icon: Microscope,
    specialtyCodes: ["radiologia", "patologia", "medicina-nuclear", "genetica"],
  },
  {
    code: "rehabilitacion-paliativos",
    name: "Rehabilitación y cuidados paliativos",
    description: "Recuperación funcional y manejo del dolor y cuidado paliativo.",
    icon: HeartPulse,
    specialtyCodes: ["rehabilitacion", "dolor-paliativos"],
  },
  {
    code: "odontologia",
    name: "Odontología",
    description: "Salud oral, endodoncia, periodoncia y rehabilitación oral.",
    icon: Smile,
    specialtyCodes: [
      "odontologia-general",
      "endodoncia",
      "periodoncia",
      "ortodoncia",
      "rehabilitacion-oral",
    ],
  },
  {
    code: "laboral-legal",
    name: "Medicina laboral y legal",
    description: "Valoración ocupacional y médico-legal.",
    icon: Scale,
    specialtyCodes: ["medicina-laboral", "medicina-legal"],
  },
];

// Índice specialty_code (normalizado) → area, construido una sola vez.
const areaBySpecialtyKey = new Map<string, MedicalArea>();
for (const area of medicalAreas) {
  for (const code of area.specialtyCodes) {
    areaBySpecialtyKey.set(normalizeSpecialtyKey(code), area);
  }
}

/** Área de una especialidad (acepta guiones o guion_bajo). */
export function getAreaForSpecialty(specialtyCode: string): MedicalArea | undefined {
  return areaBySpecialtyKey.get(normalizeSpecialtyKey(specialtyCode));
}

// Índice specialty_key (normalizado) → nombre legible, desde specialties.ts.
const specialtyNameByKey = new Map<string, string>();
for (const specialty of clinicalSpecialties) {
  specialtyNameByKey.set(normalizeSpecialtyKey(specialty.code), specialty.name);
}

/** Nombre legible de una especialidad a partir de su code (guiones o guion_bajo). */
export function specialtyDisplayName(specialtyCode: string): string {
  return (
    specialtyNameByKey.get(normalizeSpecialtyKey(specialtyCode)) ??
    specialtyCode.replace(/[-_]/g, " ")
  );
}

/** Especialidades de un área, en el orden declarado y con su metadata completa. */
export function specialtiesForArea(areaCode: string): ClinicalSpecialty[] {
  const area = medicalAreas.find((item) => item.code === areaCode);
  if (!area) return [];
  return area.specialtyCodes
    .map((code) =>
      clinicalSpecialties.find(
        (specialty) => normalizeSpecialtyKey(specialty.code) === normalizeSpecialtyKey(code),
      ),
    )
    .filter((specialty): specialty is ClinicalSpecialty => Boolean(specialty));
}

/** Todas las áreas con sus especialidades resueltas (para render de navegación). */
export function medicalAreasWithSpecialties(): {
  area: MedicalArea;
  specialties: ClinicalSpecialty[];
}[] {
  return medicalAreas.map((area) => ({
    area,
    specialties: specialtiesForArea(area.code),
  }));
}
