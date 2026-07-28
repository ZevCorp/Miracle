// Revisión de la nota recién generada — determinista, local y sin IA.
//
// Por qué existe:
// - El aviso del final de la consulta dependía SOLO del backend: `note.warnings`
//   (lo que el LLM decidiera emitir esa vez) y `note.missing_required_sections`.
//   Ninguno de los dos es determinista, así que el recordatorio salía a ratos y
//   el médico no podía confiar en él: un aviso intermitente se ignora.
// - Este módulo revisa la nota que YA está en memoria contra la plantilla
//   congelada del encounter y la transcripción. Misma entrada → misma salida,
//   siempre, sin llamadas de red.
//
// Reglas de diseño (las mismas de lib/clinical/note-audit.ts):
// - Puro y testeable: recibe objetos, devuelve hallazgos.
// - Alta precisión: cada hallazgo debe ser real y accionable. Un aviso que el
//   médico aprende a ignorar es peor que no tener aviso.
// - No inventa: lo que no se pueda comprobar con lo que hay, no se afirma.
// - Los `warnings` del backend NO se pierden: se integran como hallazgos más.
//
// Comparte vocabulario de severidad con note-audit.ts a propósito: el médico ve
// "crítico / advertencia / sugerencia" con el mismo significado en la consulta
// en vivo, en la pestaña Auditoría y en /app/auditoria.

import type {
  ClinicalDischarge,
  ClinicalNoteJson,
  EncounterTemplateSnapshot,
} from "@/lib/api/clinical";
import {
  auditSeverityPenalty,
  auditSeverityRank,
  type AuditFinding,
} from "./note-audit";
import { extractConcepts } from "./vital-concepts";

export interface NoteReview {
  hallazgos: AuditFinding[];
  criticos: number;
  advertencias: number;
  sugerencias: number;
}

export interface NoteReviewInput {
  note: ClinicalNoteJson | null | undefined;
  /** Plantilla congelada del encounter: de ahí salen las secciones obligatorias. */
  template?: EncounterTemplateSnapshot | null;
  /** Transcripción de la consulta (ya redactada). Solo se mide y se busca en ella. */
  transcript?: string | null;
}

/** Debajo de esto la IA misma declaró que no estaba segura de la sección. */
const CONFIANZA_MINIMA = 0.5;

/** Una sección con menos caracteres que esto no documenta nada útil. */
const SECCION_BREVE = 25;

/**
 * A partir de aquí se asume que hubo consulta de verdad y por tanto había
 * material que documentar. Debajo de este umbral no se reclama brevedad ni
 * signos vitales: puede ser una nota corta legítima.
 */
const TRANSCRIPCION_SUSTANCIAL = 400;

/**
 * Contenido que ocupa el campo pero no documenta nada. Se exige que sea el
 * contenido COMPLETO: "No refiere alergias" es documentación válida y no puede
 * caer aquí; "Sin información documentada." sí.
 */
const RELLENO =
  /^(?:[-—.\s]*|n\/?a|no aplica|sin (?:informaci[oó]n|datos)(?:\s+documentad[ao]s?)?|no (?:se )?document(?:a|ó|o)|no disponible|pendiente)\.?$/i;

function vacio(value: string | null | undefined): boolean {
  const text = (value ?? "").trim();
  return text === "" || RELLENO.test(text);
}

/**
 * Un valor suelto (un rótulo "26-2513", una cédula, una fecha, un nombre) no es
 * prosa truncada: es exactamente lo que la plantilla pide, y así de corto está
 * bien. La regla de brevedad solo tiene sentido sobre secciones que intentan
 * narrar algo, así que estas quedan fuera para no inventarles un problema.
 */
function pareceDato(content: string): boolean {
  return content.trim().split(/\s+/).length < 3;
}

function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Une etiquetas para el detalle, con corte legible si son muchas. */
function joinLabels(labels: string[], max = 4): string {
  if (labels.length <= max) return labels.join(", ");
  return `${labels.slice(0, max).join(", ")} y ${labels.length - max} más`;
}

/** Normaliza el cierre universal sin depender del cliente HTTP (módulo puro). */
function normalizeDischarge(
  discharge: ClinicalDischarge | null | undefined,
): ClinicalDischarge {
  return {
    plan: {
      medications: Array.isArray(discharge?.plan?.medications)
        ? discharge.plan.medications
        : [],
      non_pharmacological: Array.isArray(discharge?.plan?.non_pharmacological)
        ? discharge.plan.non_pharmacological
        : [],
      follow_up: Array.isArray(discharge?.plan?.follow_up)
        ? discharge.plan.follow_up
        : [],
    },
    recommendations: Array.isArray(discharge?.recommendations)
      ? discharge.recommendations
      : [],
    alarm_signs: Array.isArray(discharge?.alarm_signs) ? discharge.alarm_signs : [],
  };
}

function emptyReview(): NoteReview {
  return { hallazgos: [], criticos: 0, advertencias: 0, sugerencias: 0 };
}

/**
 * Una consulta asistencial tiene un paciente al frente: hay plan, control,
 * signos de alarma y recomendaciones que darle. Un informe sobre una muestra
 * (patología, laboratorio) no tiene nada de eso — se describe un espécimen.
 * Reclamarle "plan terapéutico" o "signos de alarma" a una biopsia es ruido
 * garantizado, y este módulo existe justamente para que el médico pueda
 * confiar en el aviso en vez de aprender a ignorarlo.
 */
function esInformeDeMuestra(
  template: EncounterTemplateSnapshot | null | undefined,
): boolean {
  const especialidad = (template?.specialty ?? "").toLowerCase();
  return /patolog|citolog|histolog|laboratorio|bacteriolog/.test(especialidad);
}

/**
 * Revisa la nota generada y devuelve qué falta, qué está incompleto y qué
 * conviene reforzar, ordenado de más grave a menos.
 */
export function reviewGeneratedNote(input: NoteReviewInput): NoteReview {
  const note = input.note;
  if (!note) return emptyReview();

  const hallazgos: AuditFinding[] = [];
  const sections = Array.isArray(note.sections) ? note.sections : [];
  const transcript = (input.transcript ?? "").trim();
  const discharge = normalizeDischarge(note.discharge);
  const plantilla = input.template?.sections ?? [];

  /* --- Secciones: obligatorias vs. opcionales -------------------------- */

  // Las obligatorias salen de la plantilla congelada (fuente estable) y se les
  // suman las que el backend haya marcado. Del backend solo se hace caso si la
  // sección SIGUE vacía: si el médico ya la llenó, el aviso está caduco.
  const obligatorias = new Set<string>([
    ...plantilla.filter((s) => s.required).map((s) => s.key),
    ...(Array.isArray(note.missing_required_sections)
      ? note.missing_required_sections
      : []),
  ]);

  // Se nombran una por una, con la etiqueta que la plantilla les da: el médico
  // necesita leer "falta Antecedentes", no "2 secciones sin información".
  const faltantes: { key: string; label: string; obligatoria: boolean }[] = [];
  const breves: string[] = [];
  const dudosas: string[] = [];

  for (const section of sections) {
    const label = section.label?.trim() || section.key;
    if (vacio(section.content)) {
      faltantes.push({
        key: section.key,
        label,
        obligatoria: obligatorias.has(section.key),
      });
      continue;
    }
    const contenido = section.content.trim();
    if (contenido.length < SECCION_BREVE && !pareceDato(contenido)) {
      breves.push(label);
    }
    if (
      typeof section.confidence === "number" &&
      section.confidence < CONFIANZA_MINIMA
    ) {
      dudosas.push(label);
    }
  }

  // Obligatoria que ni siquiera vino como sección en la nota.
  const presentes = new Set(sections.map((s) => s.key));
  for (const key of obligatorias) {
    if (presentes.has(key)) continue;
    faltantes.push({
      key,
      label: plantilla.find((s) => s.key === key)?.label?.trim() || key,
      obligatoria: true,
    });
  }

  // El nombre de la plantilla ancla el aviso a lo que el médico eligió usar.
  const nombrePlantilla = input.template?.name?.trim();
  const laPlantilla = nombrePlantilla ? `«${nombrePlantilla}»` : "La plantilla";

  // Las obligatorias se nombran una a una: son pocas y cada una bloquea la
  // firma. Las opcionales van en una sola línea (también nombradas) para no
  // llenar el panel con una fila por cada campo que la plantilla ni exige.
  for (const falta of faltantes.filter((f) => f.obligatoria)) {
    hallazgos.push({
      key: `falta-${falta.key}`,
      severidad: "critico",
      titulo: `Falta ${falta.label}`,
      detalle: `${laPlantilla} marca esta sección como obligatoria y quedó sin información. Complétala antes de cerrar la nota.`,
    });
  }

  const opcionalesVacias = faltantes.filter((f) => !f.obligatoria);
  if (opcionalesVacias.length > 0) {
    hallazgos.push({
      key: "secciones-vacias",
      severidad: "advertencia",
      titulo: `${pluralize(
        opcionalesVacias.length,
        "sección sin información",
        "secciones sin información",
      )}`,
      detalle: `${laPlantilla} las incluye y quedaron vacías: ${joinLabels(
        opcionalesVacias.map((f) => f.label),
      )}. Si no aplican, déjalo escrito.`,
    });
  }

  if (vacio(note.summary)) {
    hallazgos.push({
      key: "sin-resumen",
      severidad: "advertencia",
      titulo: "Sin resumen clínico",
      detalle:
        "El resumen es lo primero que lee quien continúa el caso. Escríbelo o pídeselo al asistente.",
    });
  }

  /* --- Confianza y profundidad ---------------------------------------- */

  if (dudosas.length > 0) {
    hallazgos.push({
      key: "confianza-baja",
      severidad: "advertencia",
      titulo: `${pluralize(
        dudosas.length,
        "sección con baja confianza",
        "secciones con baja confianza",
      )}`,
      detalle: `La IA no quedó segura de lo que entendió en: ${joinLabels(
        dudosas,
      )}. Contrástalas con la transcripción.`,
    });
  }

  // Solo se reclama brevedad si hubo consulta larga: una nota corta puede ser
  // perfectamente correcta para una consulta corta.
  if (breves.length > 0 && transcript.length >= TRANSCRIPCION_SUSTANCIAL) {
    hallazgos.push({
      key: "secciones-breves",
      severidad: "sugerencia",
      titulo: `${pluralize(
        breves.length,
        "sección muy breve",
        "secciones muy breves",
      )}`,
      detalle: `Frente a lo que se habló, quedó muy poco en: ${joinLabels(
        breves,
      )}. Amplía el detalle que respalde el diagnóstico.`,
    });
  }

  /* --- Cierre: plan, seguimiento, alarma, recomendaciones -------------- */

  // Todo lo que sigue (plan, control, alarma, recomendaciones, signos vitales,
  // alergias) asume un paciente al que se le indica algo. Un informe sobre una
  // muestra no tiene a quién indicarle nada: ahí la plantilla manda y estas
  // reglas se omiten enteras en vez de llenar el panel de ruido.
  const informeDeMuestra = esInformeDeMuestra(input.template);
  const meds = discharge.plan.medications;

  if (!informeDeMuestra) {
    const noFarma = discharge.plan.non_pharmacological;
    const seguimiento = discharge.plan.follow_up;
    const planVacio =
      meds.length === 0 && noFarma.length === 0 && seguimiento.length === 0;

    // Plan, control, signos de alarma y recomendaciones son partes de UNA sola
    // cosa: lo que el paciente se lleva. Cuando la consulta se dicta sin cerrar,
    // faltan casi siempre las cuatro, y sacarlas por separado llenaba el panel
    // con cuatro avisos que se corrigen de una sentada.
    const cierreFaltante: string[] = [];
    if (planVacio) cierreFaltante.push("plan terapéutico");
    else if (seguimiento.length === 0) cierreFaltante.push("control o seguimiento");
    if (discharge.alarm_signs.length === 0) cierreFaltante.push("signos de alarma");
    if (discharge.recommendations.length === 0) {
      cierreFaltante.push("recomendaciones al paciente");
    }

    if (cierreFaltante.length > 0) {
      hallazgos.push({
        key: "cierre-incompleto",
        // Sin plan no hay conducta médica; sin él, lo que falta es el detalle
        // del egreso y con eso basta una sugerencia.
        severidad: planVacio ? "advertencia" : "sugerencia",
        titulo: "Falta el cierre de la consulta",
        detalle: `No quedó registrado: ${joinLabels(
          cierreFaltante,
        )}. Es lo que el paciente se lleva y lo que respalda la atención si el cuadro empeora.`,
      });
    }

    // Una prescripción sin dosis o sin frecuencia no se puede ejecutar.
    const medsIncompletos = meds
      .filter((m) => vacio(m.dose) || vacio(m.frequency))
      .map((m) => m.name?.trim() || "medicamento sin nombre");
    if (medsIncompletos.length > 0) {
      hallazgos.push({
        key: "medicacion-incompleta",
        severidad: "advertencia",
        titulo: `${pluralize(
          medsIncompletos.length,
          "medicamento sin dosis o frecuencia",
          "medicamentos sin dosis o frecuencia",
        )}`,
        detalle: `Completa dosis y frecuencia de: ${joinLabels(
          medsIncompletos,
        )}. Sin eso la indicación no se puede cumplir.`,
      });
    }
  }

  /* --- Datos que se suelen olvidar preguntar --------------------------- */

  const vitales = extractConcepts(sections);
  const tieneVitales = Object.keys(vitales).some((k) => k.startsWith("vital."));

  if (
    !informeDeMuestra &&
    !tieneVitales &&
    transcript.length >= TRANSCRIPCION_SUSTANCIAL
  ) {
    hallazgos.push({
      key: "sin-signos-vitales",
      severidad: "sugerencia",
      titulo: "No quedaron signos vitales en la nota",
      detalle:
        "Si se tomaron, díctalos (TA, FC, FR, temperatura, saturación, peso o talla): también son los que alimentan el agente de escritorio.",
    });
  }

  // Prescribir sin haber dejado constancia de alergias es un riesgo real. Se
  // busca tanto en la nota como en lo que se habló, para no reclamar algo que
  // sí se preguntó.
  if (!informeDeMuestra && meds.length > 0) {
    const textoNota = sections.map((s) => s.content ?? "").join("\n");
    const mencionaAlergia = /alergi|al[eé]rgic/i.test(
      `${textoNota}\n${note.summary ?? ""}\n${transcript}`,
    );
    if (!mencionaAlergia) {
      hallazgos.push({
        key: "alergias-no-documentadas",
        severidad: "advertencia",
        titulo: "Se prescribió sin documentar alergias",
        detalle:
          "No aparece ninguna mención a alergias en la consulta. Déjalo escrito aunque sea para negarlas.",
      });
    }
  }

  /* --- Avisos que sí mandó el backend ---------------------------------- */

  const backendWarnings = Array.isArray(note.warnings) ? note.warnings : [];
  backendWarnings
    .map((w) => (typeof w === "string" ? w.trim() : ""))
    .filter(Boolean)
    .forEach((warning, index) => {
      hallazgos.push({
        key: `generacion-${index}`,
        severidad: "advertencia",
        titulo: "Aviso de la generación",
        detalle: warning,
      });
    });

  hallazgos.sort(
    (a, b) => auditSeverityRank(a.severidad) - auditSeverityRank(b.severidad),
  );

  return {
    hallazgos,
    criticos: hallazgos.filter((h) => h.severidad === "critico").length,
    advertencias: hallazgos.filter((h) => h.severidad === "advertencia").length,
    sugerencias: hallazgos.filter((h) => h.severidad === "sugerencia").length,
  };
}

/**
 * Puntaje de calidad 0-100 de la revisión, con la MISMA escala de penalización
 * que la auditoría del historial (crítico 30, advertencia 12, sugerencia 5):
 * el porcentaje significa lo mismo en la consulta activa y en /app/auditoria.
 */
export function noteReviewScore(review: NoteReview): number {
  const penalizacion = review.hallazgos.reduce(
    (acc, h) => acc + auditSeverityPenalty(h.severidad),
    0,
  );
  return Math.max(0, Math.min(100, 100 - penalizacion));
}

export type SectionCoverageState = "completa" | "breve" | "vacia";

export interface SectionCoverage {
  key: string;
  label: string;
  /** Obligatoria según la plantilla congelada o el backend. */
  obligatoria: boolean;
  estado: SectionCoverageState;
  /** La IA declaró confianza < 0.5 sobre lo que entendió aquí. */
  confianzaBaja: boolean;
  /** Longitud del contenido real (0 si está vacía o es relleno). */
  caracteres: number;
}

/**
 * Estado sección por sección de la nota, para pintar la cobertura de un
 * vistazo. Mismos criterios de "vacío" y "breve" que reviewGeneratedNote; las
 * obligatorias de la plantilla que ni siquiera vinieron en la nota se agregan
 * al final como vacías.
 */
export function sectionCoverage(
  note: ClinicalNoteJson | null | undefined,
  template?: EncounterTemplateSnapshot | null,
): SectionCoverage[] {
  if (!note) return [];
  const sections = Array.isArray(note.sections) ? note.sections : [];
  const plantilla = template?.sections ?? [];
  const obligatorias = new Set<string>([
    ...plantilla.filter((s) => s.required).map((s) => s.key),
    ...(Array.isArray(note.missing_required_sections)
      ? note.missing_required_sections
      : []),
  ]);

  const out: SectionCoverage[] = sections.map((section) => {
    const content = (section.content ?? "").trim();
    const estaVacia = vacio(section.content);
    return {
      key: section.key,
      label: section.label?.trim() || section.key,
      obligatoria: obligatorias.has(section.key),
      estado: estaVacia
        ? "vacia"
        : content.length < SECCION_BREVE && !pareceDato(content)
          ? "breve"
          : "completa",
      confianzaBaja:
        typeof section.confidence === "number" &&
        section.confidence < CONFIANZA_MINIMA,
      caracteres: estaVacia ? 0 : content.length,
    };
  });

  const presentes = new Set(sections.map((s) => s.key));
  for (const key of obligatorias) {
    if (presentes.has(key)) continue;
    out.push({
      key,
      label: plantilla.find((s) => s.key === key)?.label?.trim() || key,
      obligatoria: true,
      estado: "vacia",
      confianzaBaja: false,
      caracteres: 0,
    });
  }

  return out;
}

/** Etiqueta corta: "Todo en orden" | "1 crítico · 2 advertencias". */
export function noteReviewLabel(review: NoteReview): string {
  const parts: string[] = [];
  if (review.criticos > 0)
    parts.push(pluralize(review.criticos, "crítico", "críticos"));
  if (review.advertencias > 0)
    parts.push(pluralize(review.advertencias, "advertencia", "advertencias"));
  if (review.sugerencias > 0)
    parts.push(pluralize(review.sugerencias, "sugerencia", "sugerencias"));
  return parts.length ? parts.join(" · ") : "Todo en orden";
}
