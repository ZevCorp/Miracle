"use client";

import Link from "next/link";
import { TYPE_LABEL, type Consultation, type NoteSection } from "@/lib/mock";
import { formatFechaRelativa } from "@/lib/dates";
import { useStore } from "@/app/app/providers";
import { StatusBadge } from "./StatusBadge";

// Solo los campos que la tarjeta necesita; una Consultation completa también
// encaja (structural typing), pero así las páginas RSC pueden construir el objeto
// desde una fila de la base sin cargar todo el store.
type CardConsultation = Pick<
  Consultation,
  "id" | "pacienteId" | "especialidad" | "tipo" | "estado" | "motivo" | "fecha"
> & {
  /** Opcional: solo lo traen las páginas que ya cargan la nota completa. */
  note?: readonly NoteSection[] | null;
};

/**
 * El rótulo (número de caso de patología) identifica la consulta mejor que
 * "Paciente sin identificar" -que se repite en casi todas las tarjetas de
 * patología, ya que el nombre real vive dentro de la nota, no en `patients`.
 * Vive como una sección más de la nota (id "rotulo" en las plantillas de
 * patología); si la consulta no es de patología, simplemente no aparece.
 */
function rotuloDe(note: CardConsultation["note"]): string | undefined {
  const seccion = note?.find(
    (s) => s.id === "rotulo" || s.titulo === "Rótulo",
  );
  const valor = seccion?.texto?.trim();
  return valor || undefined;
}

export function ConsultationCard({
  consultation,
  active = false,
  patientName,
  rotulo: rotuloProp,
  presentation = "card",
}: {
  consultation: CardConsultation;
  active?: boolean;
  /** Nombre del paciente ya resuelto (p. ej. desde un join en RSC). Si no se pasa,
   *  se resuelve desde el store. */
  patientName?: string;
  /** Rótulo ya resuelto (p. ej. desde la columna `rotulo` en RSC). Si no se
   *  pasa, se extrae de `consultation.note` cuando esté disponible. */
  rotulo?: string | null;
  presentation?: "card" | "row";
}) {
  const { getPatient } = useStore();
  const nombre =
    patientName ?? getPatient(consultation.pacienteId)?.nombre ?? "Paciente sin identificar";
  const rotulo = rotuloProp ?? rotuloDe(consultation.note);
  return (
    <Link
      href={`/app/consultas/${consultation.id}`}
      className={`block transition-colors ${
        presentation === "row"
          ? "clinical-list-row px-1 py-3.5"
          : "rounded-[14px] border bg-surface p-4 shadow-[var(--shadow-xs)] hover:border-mist hover:bg-ice-soft/40"
      } ${active ? "border-accent ring-1 ring-accent/30" : presentation === "card" ? "border-line" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {rotulo ? (
              <span className="shrink-0 rounded-md bg-ice px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent-ink">
                {rotulo}
              </span>
            ) : null}
            <span className="truncate font-semibold text-deep">{nombre}</span>
          </div>
          <div className="truncate text-[13px] text-muted">
            {consultation.especialidad} · {TYPE_LABEL[consultation.tipo]}
          </div>
        </div>
        <StatusBadge estado={consultation.estado} />
      </div>
      <p className="mt-2 line-clamp-1 text-sm text-ink-soft">
        {consultation.motivo}
      </p>
      <div className="mt-2 text-[13px] text-muted">
        {formatFechaRelativa(consultation.fecha)}
      </div>
    </Link>
  );
}
