"use client";

import Link from "next/link";
import { formatFechaRelativa, TYPE_LABEL, type Consultation } from "@/lib/mock";
import { useStore } from "@/app/app/providers";
import { StatusBadge } from "./StatusBadge";

// Solo los campos que la tarjeta necesita; una Consultation completa también
// encaja (structural typing), pero así las páginas RSC pueden construir el objeto
// desde una fila de la base sin cargar todo el store.
type CardConsultation = Pick<
  Consultation,
  "id" | "pacienteId" | "especialidad" | "tipo" | "estado" | "motivo" | "fecha"
>;

export function ConsultationCard({
  consultation,
  active = false,
  patientName,
  presentation = "card",
}: {
  consultation: CardConsultation;
  active?: boolean;
  /** Nombre del paciente ya resuelto (p. ej. desde un join en RSC). Si no se pasa,
   *  se resuelve desde el store. */
  patientName?: string;
  presentation?: "card" | "row";
}) {
  const { getPatient } = useStore();
  const nombre =
    patientName ?? getPatient(consultation.pacienteId)?.nombre ?? "Paciente sin identificar";
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
          <div className="truncate font-semibold text-deep">{nombre}</div>
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
