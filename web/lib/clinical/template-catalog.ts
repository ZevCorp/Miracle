import type { Template } from "@/lib/mock/types";
import { clinicalSpecialties } from "./specialties";

const today = "2026-06-23";

function createTemplatesForSpecialty(
  specialty: (typeof clinicalSpecialties)[number],
): Template[] {
  const shared = ["Identificación", "Motivo de consulta", "Antecedentes relevantes"];

  return [
    {
      id: `${specialty.code}-inicial`,
      especialidadCode: specialty.code,
      nombre: `Consulta inicial · ${specialty.name}`,
      especialidad: specialty.name,
      creadaPor: "Miracle",
      predeterminada: specialty.code === "medicina-general",
      actualizada: today,
      secciones: [...shared, specialty.focus, "Examen físico dirigido", "Impresión diagnóstica", "Plan y recomendaciones"],
    },
    {
      id: `${specialty.code}-seguimiento`,
      especialidadCode: specialty.code,
      nombre: `Control y seguimiento · ${specialty.name}`,
      especialidad: specialty.name,
      creadaPor: "Miracle",
      actualizada: today,
      secciones: ["Diagnósticos activos", specialty.followUp, "Examen de control", "Resultados relevantes", "Ajuste del plan", "Próximo control y signos de alarma"],
    },
    {
      id: `${specialty.code}-valoracion`,
      especialidadCode: specialty.code,
      nombre: `${specialty.procedure} · ${specialty.name}`,
      especialidad: specialty.name,
      creadaPor: "Miracle",
      actualizada: today,
      secciones: ["Indicación y contexto clínico", "Verificación de seguridad y consentimiento", "Hallazgos", "Conducta / procedimiento realizado", "Indicaciones posteriores", "Plan de seguimiento"],
    },
  ];
}

export const clinicalTemplateCatalog: Template[] = clinicalSpecialties.flatMap(
  createTemplatesForSpecialty,
);

export const CLINICAL_TEMPLATE_COUNT = clinicalTemplateCatalog.length;
