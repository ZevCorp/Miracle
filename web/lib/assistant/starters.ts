// Preguntas de inicio del asistente, según dónde está el médico.
//
// Antes eran tres frases fijas («Dosis de amoxicilina en adultos») que valían
// lo mismo en el dashboard que con una consulta abierta. Ahora dependen de si
// hay consulta, si ya hay nota o solo transcripción, y de la especialidad: una
// pediatra no empieza por la hipertensión del adulto.

import { normalizeSpecialtyCode } from "@/lib/api/clinical";

export interface StarterInput {
  hasEncounter: boolean;
  hasNote: boolean;
  hasTranscript: boolean;
  specialtyCode?: string | null;
}

export const STARTERS_PER_SET = 4;

const GENERAL: string[] = [
  "¿Qué dice la guía sobre el manejo inicial de la hipertensión en adultos?",
  "Diferenciales de dolor abdominal agudo y qué signos de alarma revisar",
  "Dosis de amoxicilina por peso en un niño con otitis media aguda",
  "¿Cuándo hospitalizar una neumonía adquirida en la comunidad (CURB-65)?",
];

/** Dos preguntas propias por familia; completan con las generales. */
const GENERAL_BY_SPECIALTY: { match: RegExp; questions: string[] }[] = [
  {
    match: /(pediatr|neonat)/,
    questions: [
      "Planes A, B y C de la OMS para deshidratación por diarrea en niños",
      "Fiebre sin foco en un lactante menor de 3 meses: ¿qué estudios y cuándo hospitalizar?",
    ],
  },
  {
    match: /(ginecolog|obstetr)/,
    questions: [
      "Criterios diagnósticos de preeclampsia y signos de severidad",
      "Antihipertensivos seguros en el embarazo y cuáles evitar",
    ],
  },
  {
    match: /(psiquiatr|psicolog)/,
    questions: [
      "¿Cómo evalúo y documento el riesgo suicida en consulta?",
      "Primera línea para un episodio depresivo moderado en adulto",
    ],
  },
  {
    match: /urgencia/,
    questions: [
      "Criterios de sepsis y qSOFA: ¿cuándo activo el manejo inicial?",
      "Dolor torácico en urgencias: ¿qué descarta un síndrome coronario agudo?",
    ],
  },
  {
    match: /(medicina_interna|geriatr|nefrolog)/,
    questions: [
      "Estadios de enfermedad renal crónica según KDIGO y metas de presión arterial",
      "Anticoagulación en fibrilación auricular: ¿cómo uso el CHA2DS2-VA?",
    ],
  },
  {
    match: /cardiolog/,
    questions: [
      "Metas de presión arterial y combinación inicial según la guía ESC",
      "Anticoagulación en fibrilación auricular: ¿cómo uso el CHA2DS2-VA?",
    ],
  },
  {
    match: /(neumolog|infectolog)/,
    questions: [
      "Clasificación GOLD de la EPOC y tratamiento inhalado por grupo",
      "¿Cuándo hospitalizar una neumonía adquirida en la comunidad (CURB-65)?",
    ],
  },
];

const WITH_NOTE: string[] = [
  "Resume esta consulta y dime qué datos faltan por preguntar",
  "Diferenciales según lo registrado, con lo que apoya y descarta cada uno",
  "¿Qué signos de alarma debo dejar documentados en esta nota?",
  "Revisa la nota y propón ajustes de redacción sin agregar datos",
  "¿Qué dice la guía sobre el manejo de este caso?",
  "Sugiere códigos CIE-10 para la impresión diagnóstica",
];

const WITH_TRANSCRIPT_ONLY: string[] = [
  "Con lo hablado hasta ahora, ¿qué diferenciales considerar?",
  "¿Qué debería preguntar antes de cerrar la consulta?",
  "¿Qué signos de alarma debo descartar en este caso?",
  "¿Qué dice la guía sobre el manejo de este motivo de consulta?",
];

const WITH_ENCOUNTER_EMPTY: string[] = [
  "¿Qué preguntas no pueden faltar para este motivo de consulta?",
  "Diferenciales frecuentes del motivo de consulta y sus signos de alarma",
  "¿Qué examen físico dirigido debo documentar?",
  "¿Qué dice la guía sobre el abordaje inicial de este motivo?",
];

function unique(list: string[]): string[] {
  return list.filter((item, index) => list.indexOf(item) === index);
}

export function starterQuestions({ hasEncounter, hasNote, hasTranscript, specialtyCode }: StarterInput): string[] {
  if (hasEncounter && hasNote) return WITH_NOTE.slice(0, STARTERS_PER_SET);
  if (hasEncounter && hasTranscript) return WITH_TRANSCRIPT_ONLY.slice(0, STARTERS_PER_SET);
  if (hasEncounter) return WITH_ENCOUNTER_EMPTY.slice(0, STARTERS_PER_SET);

  const specialty = specialtyCode ? normalizeSpecialtyCode(specialtyCode) : "";
  const family = specialty ? GENERAL_BY_SPECIALTY.find((entry) => entry.match.test(specialty)) : undefined;
  return unique([...(family?.questions ?? []), ...GENERAL]).slice(0, STARTERS_PER_SET);
}
