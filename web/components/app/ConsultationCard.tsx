"use client";

import Link from "next/link";
import { formatFechaRelativa, TYPE_LABEL, type Consultation } from "@/lib/mock";
import { useStore } from "@/app/app/providers";
import { StatusBadge } from "./StatusBadge";

export function ConsultationCard({
  consultation,
  active = false,
}: {
  consultation: Consultation;
  active?: boolean;
}) {
  const { getPatient } = useStore();
  const patient = getPatient(consultation.pacienteId);
  return (
    <Link
      href={`/app/consultas/${consultation.id}`}
      className={`block rounded-lg border bg-surface p-4 transition-all hover:border-mist hover:shadow-[var(--shadow-sm)] ${
        active ? "border-accent ring-1 ring-accent/30" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-deep">
            {patient?.nombre ?? "Paciente sin identificar"}
          </div>
          <div className="truncate text-xs text-muted">
            {consultation.especialidad} · {TYPE_LABEL[consultation.tipo]}
          </div>
        </div>
        <StatusBadge estado={consultation.estado} />
      </div>
      <p className="mt-2 line-clamp-1 text-sm text-ink-soft">
        {consultation.motivo}
      </p>
      <div className="mt-2 text-xs text-muted">
        {formatFechaRelativa(consultation.fecha)}
      </div>
    </Link>
  );
}
