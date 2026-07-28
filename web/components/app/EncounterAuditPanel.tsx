"use client";

// Auditoría de la consulta EN VIVO — tablero de solo lectura.
//
// Todo lo que se pinta aquí se CALCULA de datos que ya están en memoria en la
// página (encounter, nota, revisión determinista, transcripción). No hay ni una
// llamada de red ni una escritura: este panel no puede dañar nada — puede
// mirarse mil veces, en cualquier estado de la consulta, y lo peor que hace es
// mostrar "aún no hay datos". La única acción posible es navegar a otra
// revisión, que ya existía en la versión anterior del tab.
//
// Qué responde, de arriba a abajo:
//   1. ¿Qué tan bien está la nota? (puntaje con la misma escala de /app/auditoria)
//   2. ¿Qué exactamente debo corregir? (hallazgos de la revisión determinista)
//   3. ¿Cómo quedó cada sección? (cobertura: completa / breve / vacía / dudosa)
//   4. ¿Qué datos duros se detectaron? (los mismos conceptos que recibe el agente)
//   5. ¿De dónde salió esta nota? (trazabilidad: hitos, plantilla, privacidad,
//      cadena de revisiones)

import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  History,
  LayoutTemplate,
  ShieldCheck,
} from "lucide-react";
import type { ClinicalEncounter, ClinicalNoteJson } from "@/lib/api/clinical";
import {
  noteReviewLabel,
  noteReviewScore,
  sectionCoverage,
  type NoteReview,
  type SectionCoverage,
} from "@/lib/clinical/note-review";
import { extractConcepts, type ConceptKey } from "@/lib/clinical/vital-concepts";
import { specialtyDisplayName } from "@/lib/clinical/medical-areas";
import { AuditFindingList } from "@/components/app/AuditFindings";

/* ------------------------------------------------------------------ */
/* Presentación                                                        */
/* ------------------------------------------------------------------ */

const CONCEPT_LABEL: Record<ConceptKey, string> = {
  "consulta.motivo": "Motivo de consulta",
  "paciente.edad": "Edad",
  "vital.talla": "Talla (m)",
  "vital.peso": "Peso (kg)",
  "vital.presion.sistolica": "TA sistólica",
  "vital.presion.diastolica": "TA diastólica",
  "vital.frecuencia.cardiaca": "FC (lpm)",
  "vital.frecuencia.respiratoria": "FR (rpm)",
  "vital.temperatura": "Temp (°C)",
  "vital.saturacion": "SatO₂ (%)",
};

const COVERAGE_STYLE: Record<
  SectionCoverage["estado"],
  { dot: string; label: string }
> = {
  completa: { dot: "bg-success", label: "Completa" },
  breve: { dot: "bg-warning", label: "Muy breve" },
  vacia: { dot: "bg-danger", label: "Sin información" },
};

function fecha(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

/** Anillo de puntaje. SVG puro: sin dependencias y se ve igual en todo lado. */
function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 85 ? "text-success" : score >= 60 ? "text-warning" : "text-danger";
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className={`relative h-20 w-20 shrink-0 ${color}`}>
      <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          strokeWidth="6"
          className="stroke-[var(--color-ice)]"
        />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-bold">
        {score}
      </span>
    </div>
  );
}

function SeverityChip({
  count,
  singular,
  plural,
  className,
}: {
  count: number;
  singular: string;
  plural: string;
  className: string;
}) {
  if (count === 0) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {count} {count === 1 ? singular : plural}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

export function EncounterAuditPanel({
  encounter,
  note,
  review,
  transcriptLength,
  identityProtected,
  onOpenEncounter,
}: {
  encounter: ClinicalEncounter | null;
  /** Nota rehidratada (la que ve el médico), o null si aún no hay. */
  note: ClinicalNoteJson | null;
  /** Revisión determinista ya calculada por la página (se recalcula al editar). */
  review: NoteReview;
  /** Longitud de la transcripción en pantalla (solo se muestra el número). */
  transcriptLength: number;
  /** true si el redactor tapa nombre+documento (hay paciente asociado). */
  identityProtected: boolean;
  onOpenEncounter: (id: string) => void;
}) {
  const score = noteReviewScore(review);
  const cobertura = useMemo(
    () => sectionCoverage(note, encounter?.template_snapshot),
    [note, encounter?.template_snapshot],
  );
  const vitales = useMemo(() => extractConcepts(note?.sections), [note]);
  const vitalEntries = Object.entries(vitales) as [
    ConceptKey,
    { value: string; evidence: string },
  ][];

  const snapshot = encounter?.template_snapshot;
  const completada = encounter?.status === "completed";

  const hitos = [
    {
      titulo: "Consulta creada",
      detalle: fecha(encounter?.created_at) ?? "Fecha no disponible",
      done: true,
    },
    {
      titulo: "Transcripción capturada",
      detalle:
        transcriptLength > 0
          ? `${transcriptLength.toLocaleString("es-CO")} caracteres registrados.`
          : "Aún no hay transcripción.",
      done: transcriptLength > 0,
    },
    {
      titulo: "Nota generada por IA",
      detalle: note
        ? `${note.sections.length} secciones estructuradas.`
        : "Aún no se genera la nota.",
      done: Boolean(note),
    },
    {
      titulo: "Consulta completada",
      detalle: completada
        ? (fecha(encounter?.updated_at) ?? "Nota revisada y guardada.")
        : "Se completa al guardar la nota revisada.",
      done: completada,
    },
  ];

  return (
    <div className="space-y-5">
      {/* 1 · Puntaje ---------------------------------------------------- */}
      <section className="rounded-xl border border-line bg-surface p-5 shadow-[var(--shadow-xs)] sm:p-6">
        <div className="flex flex-wrap items-center gap-4 sm:gap-5">
          <ScoreRing score={score} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Calidad documental
            </p>
            <p className="mt-0.5 font-display text-lg font-semibold text-deep">
              {noteReviewLabel(review)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {review.hallazgos.length === 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
                  <CheckCircle2 size={13} /> Lista para guardar y firmar
                </span>
              ) : (
                <>
                  <SeverityChip count={review.criticos} singular="crítico" plural="críticos" className="bg-danger-soft text-danger" />
                  <SeverityChip count={review.advertencias} singular="advertencia" plural="advertencias" className="bg-warning-soft text-warning" />
                  <SeverityChip count={review.sugerencias} singular="sugerencia" plural="sugerencias" className="bg-accent-soft text-accent" />
                </>
              )}
            </div>
          </div>
          <p className="w-full text-xs leading-relaxed text-muted sm:w-44">
            Se recalcula en vivo con cada edición. Misma escala que la auditoría
            del historial.
          </p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 2 · Hallazgos ------------------------------------------------ */}
        <section className="rounded-xl border border-line bg-surface p-5 shadow-[var(--shadow-xs)]">
          <h3 className="font-display text-base font-semibold text-deep">
            Qué se puede mejorar
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            Corrígelo en la pestaña Nota clínica; esta lista se actualiza sola.
          </p>
          <div className="mt-4">
            <AuditFindingList
              hallazgos={review.hallazgos}
              emptyLabel="Sin observaciones — la nota está completa y consistente."
            />
          </div>
        </section>

        {/* 3 · Cobertura por sección ------------------------------------ */}
        <section className="rounded-xl border border-line bg-surface p-5 shadow-[var(--shadow-xs)]">
          <h3 className="font-display text-base font-semibold text-deep">
            Cobertura de la nota
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            Estado de cada sección de la plantilla{snapshot?.name ? ` «${snapshot.name}»` : ""}.
          </p>
          {cobertura.length === 0 ? (
            <p className="mt-4 rounded-md bg-ice-soft px-3 py-2.5 text-sm text-muted">
              Aún no hay nota generada que cubrir.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {cobertura.map((section) => {
                const style = COVERAGE_STYLE[section.estado];
                return (
                  <li
                    key={section.key}
                    className="flex items-center gap-2.5 rounded-md border border-line/70 px-3 py-2"
                  >
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`}
                      aria-label={style.label}
                      title={style.label}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-deep">
                      {section.label}
                    </span>
                    {section.obligatoria ? (
                      <span className="shrink-0 rounded-full bg-ice px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                        Obligatoria
                      </span>
                    ) : null}
                    {section.confianzaBaja ? (
                      <span
                        className="shrink-0 text-warning"
                        title="La IA tuvo baja confianza en esta sección"
                        aria-label="La IA tuvo baja confianza en esta sección"
                      >
                        <AlertTriangle size={14} />
                      </span>
                    ) : null}
                    <span className="shrink-0 text-xs tabular-nums text-muted">
                      {section.estado === "vacia"
                        ? style.label
                        : `${section.caracteres.toLocaleString("es-CO")} car.`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* 4 · Datos estructurados detectados ----------------------------- */}
      <section className="rounded-xl border border-line bg-surface p-5 shadow-[var(--shadow-xs)]">
        <div className="flex items-start gap-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ice text-accent">
            <Activity size={16} />
          </span>
          <div>
            <h3 className="font-display text-base font-semibold text-deep">
              Datos estructurados detectados
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              Son los mismos valores que recibe el agente de escritorio. Pasa el
              cursor sobre uno para ver la frase de la nota que lo respalda.
            </p>
          </div>
        </div>
        {vitalEntries.length === 0 ? (
          <p className="mt-4 rounded-md bg-ice-soft px-3 py-2.5 text-sm text-muted">
            No se detectaron signos vitales ni datos del paciente en la nota. Si
            se tomaron, díctalos con su etiqueta («TA 120/80», «peso 70»).
          </p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {vitalEntries.map(([key, concept]) => (
              <li
                key={key}
                title={`Evidencia: «${concept.evidence}»`}
                className="inline-flex cursor-default items-baseline gap-1.5 rounded-lg border border-line bg-pearl px-3 py-1.5"
              >
                <span className="text-xs font-medium text-muted">
                  {CONCEPT_LABEL[key]}
                </span>
                <span className="font-display text-sm font-bold tabular-nums text-deep">
                  {concept.value}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 5 · Trazabilidad ----------------------------------------------- */}
      <section className="rounded-xl border border-line bg-surface p-5 shadow-[var(--shadow-xs)] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-ice text-accent">
            <History size={18} />
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold text-deep">
              Trazabilidad
            </h3>
            <p className="mt-0.5 text-sm text-muted">
              De dónde salió esta nota y en qué estado va.
            </p>
          </div>
        </div>

        <ol className="mt-6 border-l border-line pl-5">
          {hitos.map((hito) => (
            <li key={hito.titulo} className="relative pb-5 last:pb-0">
              <span
                className={`absolute -left-[25px] top-1 h-3 w-3 rounded-full border-2 border-surface ${
                  hito.done ? "bg-accent" : "bg-mist"
                }`}
              />
              <p
                className={`text-sm font-semibold ${hito.done ? "text-deep" : "text-muted"}`}
              >
                {hito.titulo}
              </p>
              <p className="mt-0.5 text-sm text-muted">{hito.detalle}</p>
            </li>
          ))}
        </ol>

        <dl className="mt-5 space-y-2.5 border-t border-line pt-4 text-sm">
          <div className="flex items-start gap-2.5">
            <LayoutTemplate size={15} className="mt-0.5 shrink-0 text-accent" />
            <div className="min-w-0">
              <dt className="font-semibold text-deep">Plantilla congelada</dt>
              <dd className="text-muted">
                {snapshot
                  ? `${snapshot.name} · ${snapshot.sections?.length ?? 0} secciones · ${specialtyDisplayName(snapshot.specialty)}. No cambia aunque la plantilla original se edite.`
                  : "Sin información de plantilla."}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-success" />
            <div className="min-w-0">
              <dt className="font-semibold text-deep">Privacidad</dt>
              <dd className="text-muted">
                {identityProtected
                  ? "El nombre y el documento del paciente se taparon antes de enviar cualquier texto a la IA."
                  : "Sin paciente asociado: solo se ocultan números de documento en el texto enviado a la IA."}
              </dd>
            </div>
          </div>
        </dl>

        {encounter?.supersedes_encounter_id || encounter?.replaced_by_encounter_id ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
            {encounter?.supersedes_encounter_id ? (
              <button
                type="button"
                onClick={() => onOpenEncounter(encounter.supersedes_encounter_id!)}
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-deep hover:border-mist"
              >
                Abrir revisión anterior
              </button>
            ) : null}
            {encounter?.replaced_by_encounter_id ? (
              <button
                type="button"
                onClick={() => onOpenEncounter(encounter.replaced_by_encounter_id!)}
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
              >
                Abrir revisión más reciente
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
