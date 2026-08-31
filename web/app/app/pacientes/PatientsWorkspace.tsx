"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { useStore } from "@/app/app/providers";
import { PatientDossier } from "@/components/app/PatientDossier";
import { usePeek } from "@/components/app/PeekProvider";
import { Avatar } from "@/components/ui/Avatar";

/**
 * EL EXPEDIENTE: /app/pacientes deja de ser una lista que navega y se vuelve
 * un espacio de trabajo de dos paneles — la lista compacta a la izquierda y el
 * dossier del seleccionado SIEMPRE visible a la derecha. Cambiar de paciente
 * es un clic sin viaje; iniciar su consulta o abrir su nota, uno más.
 *
 * En pantallas angostas (<lg) no hay sitio para dos paneles: la fila abre el
 * panel lateral (PatientPeek), exactamente la conducta anterior.
 *
 * ANTI-DESAJUSTE DE HIDRATACIÓN: la selección vive en estado con un inicial
 * determinista (la primera fila), y el panel derecho SIEMPRE se renderiza con
 * `hidden lg:block` — un solo árbol, idéntico en servidor y cliente. El
 * matchMedia solo corre dentro del handler del clic.
 */

export interface PatientRow {
  id: string;
  nombre: string;
  edad: number | null;
  sexo: string | null;
  documento: string | null;
  eps: string | null;
}

export function PatientsWorkspace({
  rows,
  counts,
}: {
  rows: PatientRow[];
  /** RPC patient_consultation_counts, ya volcada a objeto (un Map no viaja
   *  de un componente de servidor a uno de cliente). */
  counts: Record<string, number>;
}) {
  const { getPatient } = useStore();
  const { openPeek } = usePeek();
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);

  // Buscar o paginar cambia las filas: si la seleccionada ya no está, se
  // selecciona la primera de la página nueva.
  useEffect(() => {
    if (!rows.some((r) => r.id === selectedId)) {
      setSelectedId(rows[0]?.id ?? null);
    }
  }, [rows, selectedId]);

  function alClic(id: string) {
    setSelectedId(id);
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      openPeek({ kind: "patient", id }, rows.map((r) => r.id));
    }
  }

  const seleccionadaFila = rows.find((r) => r.id === selectedId) ?? null;
  const seleccionado = selectedId ? getPatient(selectedId) : undefined;

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
      {/* Izquierda: la lista compacta. */}
      <ul className="clinical-list stagger-in">
        {rows.map((p) => {
          const activa = p.id === selectedId;
          return (
            <li key={p.id} className="clinical-list-row">
              <button
                type="button"
                onClick={() => alClic(p.id)}
                aria-current={activa ? "true" : undefined}
                data-light
                className={`flex min-h-[3.25rem] w-full items-center gap-3 px-3.5 py-2.5 text-left ${
                  activa ? "bg-accent-soft/60" : ""
                }`}
              >
                <Avatar name={p.nombre} size="sm" />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-sm font-semibold ${
                      activa ? "text-accent-ink" : "text-deep"
                    }`}
                  >
                    {p.nombre}
                  </span>
                  <span className="data block truncate text-[12px] text-muted">
                    {p.documento || "Documento pendiente"}
                  </span>
                </span>
                <span className="data shrink-0 text-[11px] tabular-nums text-muted">
                  {counts[p.id] ?? 0}
                </span>
                <ChevronRight
                  size={15}
                  className={`shrink-0 text-muted lg:hidden`}
                />
              </button>
            </li>
          );
        })}
      </ul>

      {/* Derecha: el dossier fijo (solo lg+; abajo la fila abre el panel). */}
      <div className="clinical-panel hidden min-h-[26rem] overflow-hidden lg:block">
        {seleccionado ? (
          <PatientDossier patient={seleccionado} />
        ) : seleccionadaFila ? (
          /* Paciente fuera del caché del cliente (búsquedas profundas): lo que
             el servidor sí trajo, y la salida a la ficha completa. Nunca se
             auto-navega: la decisión es del médico. */
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <Avatar name={seleccionadaFila.nombre} size="md" />
            <div>
              <p className="font-semibold text-deep">{seleccionadaFila.nombre}</p>
              <p className="data mt-0.5 text-[12px] text-muted">
                {seleccionadaFila.documento || "Documento pendiente"}
                {seleccionadaFila.edad ? ` · ${seleccionadaFila.edad} años` : ""}
                {seleccionadaFila.eps ? ` · ${seleccionadaFila.eps}` : ""}
              </p>
            </div>
            <p className="max-w-xs text-sm text-muted">
              La ficha completa de este paciente no está en la carga rápida.
            </p>
            <Link
              href={`/app/pacientes/${seleccionadaFila.id}`}
              className="clinical-secondary min-h-10 px-4"
            >
              Abrir ficha completa <ArrowUpRight size={14} />
            </Link>
          </div>
        ) : (
          <p className="flex h-full items-center justify-center p-8 text-sm text-muted">
            Selecciona un paciente para ver su expediente.
          </p>
        )}
      </div>
    </div>
  );
}
