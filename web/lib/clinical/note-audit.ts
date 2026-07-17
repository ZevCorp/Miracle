// Motor de auditoría de notas clínicas — determinista y puro (sin IA, sin red).
//
// Por qué existe:
// - La auditoría anterior solo daba un porcentaje de "completitud" (5 ítems, dos
//   fijos en `true`). No decía QUÉ mejorar en una nota concreta.
// - Este módulo analiza los datos que ya guarda cada consulta (secciones de la
//   nota, códigos, estado, firma, resumen) y devuelve HALLAZGOS accionables: qué
//   está incompleto o inconsistente y cómo corregirlo, con una severidad.
//
// Reglas de diseño:
// - Puro y testeable: no toca Supabase ni el backend; recibe el objeto y devuelve
//   el reporte. Sirve igual en server components (/app/auditoria) y en el cliente
//   (pestaña Auditoría de la consulta).
// - Alta precisión: cada hallazgo debe ser real y accionable, no ruido. Un médico
//   lo va a leer antes de firmar.
// - No inventa datos: si algo no se puede comprobar con lo que hay, no se afirma.

import type { ClinicalCode, ConsultationStatus, NoteSection } from "@/lib/mock";

export type AuditSeverity = "critico" | "advertencia" | "sugerencia";

export interface AuditFinding {
  /** Clave estable del tipo de hallazgo (para keys de React / dedupe). */
  key: string;
  severidad: AuditSeverity;
  /** Qué pasa, en una línea. */
  titulo: string;
  /** Cómo mejorarlo — accionable. */
  detalle: string;
}

export interface AuditReport {
  hallazgos: AuditFinding[];
  /** Calidad documental 0-100 (100 = sin observaciones). */
  puntaje: number;
  criticos: number;
  advertencias: number;
  sugerencias: number;
}

/** Forma mínima que necesita la auditoría; la satisface `Consultation` y las filas del store. */
export interface AuditableConsultation {
  estado: ConsultationStatus;
  motivo?: string | null;
  resumen?: string | null;
  note?: readonly NoteSection[] | null;
  codigos?: readonly ClinicalCode[] | null;
  /** Solo se comprueba su presencia (nota firmada). */
  firma?: unknown;
}

const SEVERITY_ORDER: Record<AuditSeverity, number> = {
  critico: 0,
  advertencia: 1,
  sugerencia: 2,
};

const SEVERITY_PENALTY: Record<AuditSeverity, number> = {
  critico: 30,
  advertencia: 12,
  sugerencia: 5,
};

/** Rango numérico de una severidad (menor = más grave). Útil para ordenar. */
export function auditSeverityRank(severidad: AuditSeverity): number {
  return SEVERITY_ORDER[severidad];
}

/** Contenido en texto plano de una sección (une la lista o toma el texto), recortado. */
export function sectionContent(section: NoteSection): string {
  if (section.kind === "lista") {
    return (section.items ?? [])
      .map((i) => i.trim())
      .filter(Boolean)
      .join("\n");
  }
  return (section.texto ?? "").trim();
}

function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Une títulos de sección para el detalle, con corte legible si son muchos. */
function joinTitles(titles: string[], max = 4): string {
  if (titles.length <= max) return titles.join(", ");
  return `${titles.slice(0, max).join(", ")} y ${titles.length - max} más`;
}

/**
 * Audita una consulta y devuelve los hallazgos ordenados por severidad
 * (crítico → advertencia → sugerencia), un puntaje de calidad y los conteos.
 */
export function auditConsultation(c: AuditableConsultation): AuditReport {
  const hallazgos: AuditFinding[] = [];

  const note = c.note ?? [];
  const codigos = c.codigos ?? [];
  const firmada = Boolean(c.firma);
  const cerrada = c.estado === "aprobada" || c.estado === "exportada";
  // "Bloqueada": la nota ya no debería tener huecos (firmada o cerrada).
  const bloqueada = firmada || cerrada;

  const seccionesVacias = note.filter((s) => sectionContent(s) === "");
  const seccionesLlenas = note.length - seccionesVacias.length;
  const textoTotal = note.map(sectionContent).join(" ").trim();

  const dxAceptado = codigos.some(
    (k) => k.sistema === "CIE-10" && k.estado === "aceptado",
  );
  const cupsAceptado = codigos.some(
    (k) => k.sistema === "CUPS" && k.estado === "aceptado",
  );
  const sugeridos = codigos.filter((k) => k.estado === "sugerido").length;

  // 1) Motivo de consulta ausente.
  if (!c.motivo || !c.motivo.trim()) {
    hallazgos.push({
      key: "motivo-ausente",
      severidad: "advertencia",
      titulo: "Sin motivo de consulta",
      detalle:
        "Documenta la razón de la atención; es un campo obligatorio para el reporte RIPS.",
    });
  }

  // 2) Secciones sin contenido. Si la nota está bloqueada (firmada/cerrada) es
  // una inconsistencia grave; si sigue en edición, es algo por completar.
  if (seccionesVacias.length > 0) {
    const titulos = seccionesVacias.map((s) => s.titulo);
    hallazgos.push({
      key: "secciones-vacias",
      severidad: bloqueada ? "critico" : "advertencia",
      titulo: bloqueada
        ? `Nota ${firmada ? "firmada" : "cerrada"} con ${pluralize(
            seccionesVacias.length,
            "sección vacía",
            "secciones vacías",
          )}`
        : `${pluralize(
            seccionesVacias.length,
            "sección sin contenido",
            "secciones sin contenido",
          )}`,
      detalle: `Completa: ${joinTitles(titulos)}.`,
    });
  }

  // 3) Diagnóstico principal (CIE-10). Sin él no puede reportarse a RIPS; si la
  // nota ya está bloqueada, es crítico.
  if (!dxAceptado) {
    hallazgos.push({
      key: "sin-diagnostico",
      severidad: bloqueada ? "critico" : "advertencia",
      titulo: "Sin diagnóstico principal (CIE-10)",
      detalle:
        "Acepta o agrega un código CIE-10 en la pestaña Codificación; sin diagnóstico la nota no puede reportarse a RIPS.",
    });
  }

  // 4) Códigos sugeridos por la IA sin resolver (ni aceptados ni descartados).
  if (sugeridos > 0) {
    hallazgos.push({
      key: "codigos-sin-resolver",
      severidad: "advertencia",
      titulo: `${pluralize(
        sugeridos,
        "código sugerido sin revisar",
        "códigos sugeridos sin revisar",
      )}`,
      detalle:
        "Acepta los que apliquen y descarta el resto en la pestaña Codificación.",
    });
  }

  // 5) Procedimiento (CUPS). No siempre aplica, por eso es sugerencia.
  if (!cupsAceptado) {
    hallazgos.push({
      key: "sin-procedimiento",
      severidad: "sugerencia",
      titulo: "Sin procedimiento (CUPS)",
      detalle:
        "Si la atención incluyó un procedimiento, agrégalo (CUPS) para completar el reporte.",
    });
  }

  // 6) Resumen clínico ausente.
  if (!c.resumen || !c.resumen.trim()) {
    hallazgos.push({
      key: "sin-resumen",
      severidad: "sugerencia",
      titulo: "Sin resumen clínico",
      detalle: "Un resumen breve agiliza la lectura y la continuidad del cuidado.",
    });
  }

  // 7) Nota muy breve: hay secciones con contenido pero el detalle total es
  // mínimo (posible plantilla apenas diligenciada). No se dispara si la nota
  // está completamente vacía (ya cubierto por el hallazgo de secciones vacías).
  if (seccionesLlenas > 0 && textoTotal.length < 40) {
    hallazgos.push({
      key: "nota-breve",
      severidad: "sugerencia",
      titulo: "La nota es muy breve",
      detalle:
        "Amplía el detalle clínico de las secciones para respaldar el diagnóstico y el plan.",
    });
  }

  hallazgos.sort(
    (a, b) => auditSeverityRank(a.severidad) - auditSeverityRank(b.severidad),
  );

  const criticos = hallazgos.filter((h) => h.severidad === "critico").length;
  const advertencias = hallazgos.filter((h) => h.severidad === "advertencia").length;
  const sugerencias = hallazgos.filter((h) => h.severidad === "sugerencia").length;

  const penalizacion = hallazgos.reduce(
    (acc, h) => acc + SEVERITY_PENALTY[h.severidad],
    0,
  );
  const puntaje = Math.max(0, Math.min(100, 100 - penalizacion));

  return { hallazgos, puntaje, criticos, advertencias, sugerencias };
}

/** Severidad más grave del reporte (para ordenar/priorizar), o null si no hay hallazgos. */
export function worstSeverity(report: AuditReport): AuditSeverity | null {
  if (report.criticos > 0) return "critico";
  if (report.advertencias > 0) return "advertencia";
  if (report.sugerencias > 0) return "sugerencia";
  return null;
}

/** Etiqueta corta del reporte: "Sin observaciones" | "1 crítico · 2 advertencias". */
export function auditSummaryLabel(report: AuditReport): string {
  const parts: string[] = [];
  if (report.criticos > 0)
    parts.push(pluralize(report.criticos, "crítico", "críticos"));
  if (report.advertencias > 0)
    parts.push(pluralize(report.advertencias, "advertencia", "advertencias"));
  if (report.sugerencias > 0)
    parts.push(pluralize(report.sugerencias, "sugerencia", "sugerencias"));
  return parts.length ? parts.join(" · ") : "Sin observaciones";
}
