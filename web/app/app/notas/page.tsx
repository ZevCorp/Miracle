"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { useStore } from "@/app/app/providers";
import {
  formatFechaRelativa,
  patientById,
  STATUS_LABEL,
  type ConsultationStatus,
} from "@/lib/mock";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";

const estados: (ConsultationStatus | "todas")[] = [
  "todas",
  "borrador",
  "revisada",
  "aprobada",
  "exportada",
];

export default function NotasPage() {
  const { consultations } = useStore();
  const [estado, setEstado] = useState<ConsultationStatus | "todas">("todas");

  const filtradas = useMemo(
    () =>
      estado === "todas"
        ? consultations
        : consultations.filter((c) => c.estado === estado),
    [consultations, estado],
  );

  function count(e: ConsultationStatus | "todas") {
    return e === "todas"
      ? consultations.length
      : consultations.filter((c) => c.estado === e).length;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-deep">Notas clínicas</h1>
      <p className="text-sm text-muted">
        Bandeja de notas por estado de revisión.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {estados.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEstado(e)}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              estado === e
                ? "border-accent bg-accent-soft text-accent-ink"
                : "border-line bg-white text-ink-soft hover:border-mist"
            }`}
          >
            {e === "todas" ? "Todas" : STATUS_LABEL[e]}
            <span className="rounded-full bg-ice px-1.5 text-xs text-muted">
              {count(e)}
            </span>
          </button>
        ))}
      </div>

      {filtradas.length ? (
        <div className="mt-5 overflow-hidden rounded-lg border border-line bg-white">
          {filtradas.map((c, i) => {
            const patient = patientById(c.pacienteId);
            return (
              <Link
                key={c.id}
                href={`/app/consultas/${c.id}`}
                className={`flex items-center gap-4 px-5 py-4 hover:bg-ice-soft ${
                  i !== 0 ? "border-t border-line" : ""
                }`}
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ice text-accent">
                  <FileText size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-deep">
                    {patient?.nombre} · {c.motivo}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {c.especialidad} · {formatFechaRelativa(c.fecha)}
                  </div>
                </div>
                <StatusBadge estado={c.estado} />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState title="Sin notas en este estado" />
        </div>
      )}
    </div>
  );
}
