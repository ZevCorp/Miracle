"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, Mic, Pencil } from "lucide-react";
import { useStore } from "@/app/app/providers";
import { PatientFormDialog } from "@/components/app/PatientFormDialog";
import { usePeek } from "@/components/app/PeekProvider";
import { StatusBadge, STATUS_BAR } from "@/components/app/StatusBadge";
import { Avatar } from "@/components/ui/Avatar";
import { HoverHint } from "@/components/ui/HoverHint";
import { ZONA_CLINICA, formatFechaRelativa } from "@/lib/dates";
import { STATUS_LABEL, type Consultation, type Patient } from "@/lib/mock";

/**
 * EL DOSSIER: la ficha viva de un paciente — quién es, sus antecedentes, su
 * línea de vida y su historia reciente — con las acciones al pie.
 *
 * Es UNA sola pieza compartida por dos superficies: el panel lateral
 * (PatientPeek, en pantallas angostas) y el expediente de dos paneles de
 * /app/pacientes (donde vive fijo a la derecha). Así la ficha se ve idéntica
 * llegues por donde llegues.
 */
export function PatientDossier({
  patient,
  onBeforeNavigate,
}: {
  patient: Patient;
  /** El peek lo usa para cerrarse antes de navegar; el workspace no lo pasa. */
  onBeforeNavigate?: () => void;
}) {
  const { consultations } = useStore();
  const { openPeek } = usePeek();
  const [editando, setEditando] = useState(false);

  const historia = useMemo(
    () =>
      consultations
        .filter((c) => c.pacienteId === patient.id)
        .sort((a, b) => (a.fecha < b.fecha ? 1 : -1)),
    [consultations, patient.id],
  );
  const recientes = historia.slice(0, 8);
  const idsHistoria = recientes.map((c) => c.id);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Cabecera */}
      <div className="flex items-center gap-3 border-b border-line/60 px-4 py-4 sm:px-5">
        <Avatar name={patient.nombre} size="md" className="shadow-[var(--neu-out)]" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-deep">{patient.nombre}</p>
          <p className="data mt-0.5 truncate text-[12px] text-muted">
            {patient.documento}
            <span className="font-sans">
              {patient.edad ? ` · ${patient.edad} años` : ""}
              {patient.sexo ? ` · ${patient.sexo === "F" ? "Femenino" : "Masculino"}` : ""}
              {patient.eps && patient.eps !== "Por registrar" ? ` · ${patient.eps}` : ""}
            </span>
          </p>
        </div>
      </div>

      {/* Ficha + línea de vida + historia */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <dl className="space-y-3">
          {(
            [
              ["Antecedentes", patient.antecedentes],
              ["Alergias", patient.alergias],
              ["Medicamentos", patient.medicamentos],
            ] as const
          ).map(([titulo, valores]) => (
            <div key={titulo}>
              <dt className="doc-label">{titulo}</dt>
              <dd
                className={`mt-0.5 text-sm leading-relaxed ${
                  titulo === "Alergias" && valores.length
                    ? "font-semibold text-danger"
                    : "text-ink-soft"
                }`}
              >
                {valores.length ? valores.join(", ") : "—"}
              </dd>
            </div>
          ))}
        </dl>

        {historia.length > 1 ? (
          <>
            <h3 className="doc-label mb-1.5 mt-5">Línea de vida</h3>
            <LifelineDots
              consultas={historia}
              onSelect={(id) =>
                openPeek({ kind: "consultation", id }, historia.map((c) => c.id))
              }
            />
          </>
        ) : null}

        <h3 className="doc-label mb-2 mt-5">Historia reciente</h3>
        {recientes.length ? (
          <ul className="clinical-list">
            {recientes.map((c) => (
              <li key={c.id} className="clinical-list-row">
                <button
                  type="button"
                  onClick={() =>
                    openPeek({ kind: "consultation", id: c.id }, idsHistoria)
                  }
                  className="flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left"
                  data-light
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-deep">
                      {c.motivo || "Sin motivo registrado"}
                    </span>
                    <span className="block truncate text-[12px] text-muted">
                      {c.especialidad} · {formatFechaRelativa(c.fecha)}
                    </span>
                  </span>
                  <StatusBadge estado={c.estado} />
                  <ChevronRight size={15} className="shrink-0 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="clinical-panel px-4 py-3 text-sm text-muted">
            Sin consultas registradas todavía.
          </p>
        )}
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2 border-t border-line/60 px-4 py-3 sm:px-5">
        <Link
          href={`/app/consultas/nueva?paciente=${encodeURIComponent(patient.id)}`}
          onClick={onBeforeNavigate}
          className="clinical-primary min-h-11 px-4"
          data-light
        >
          <Mic size={16} /> Iniciar consulta
        </Link>
        <span className="min-w-2 flex-1" />
        {/* Solo icono: la fila vive también dentro del panel lateral, donde tres
            botones con texto no caben. */}
        <HoverHint label="Editar ficha">
          <button
            type="button"
            onClick={() => setEditando(true)}
            aria-label="Editar ficha del paciente"
            className="clinical-tertiary min-h-11 px-3"
          >
            <Pencil size={15} />
          </button>
        </HoverHint>
        <Link
          href={`/app/pacientes/${patient.id}`}
          onClick={onBeforeNavigate}
          className="clinical-tertiary min-h-11 px-3.5"
        >
          Abrir ficha <ArrowUpRight size={15} />
        </Link>
      </div>

      {editando ? (
        <PatientFormDialog
          patient={patient}
          onClose={() => setEditando(false)}
          onSaved={() => setEditando(false)}
        />
      ) : null}
    </div>
  );
}

const MES_CORTO = new Intl.DateTimeFormat("es-CO", {
  timeZone: ZONA_CLINICA,
  day: "2-digit",
  month: "short",
});

/**
 * La línea de vida: las consultas del paciente como estaciones horizontales,
 * más antigua a la izquierda, coloreadas por estado (el mismo código de color
 * de toda la app). No es adorno: es la trayectoria del paciente de un vistazo
 * — cuándo vino, qué tan seguido, y si algo quedó a medio firmar.
 */
export function LifelineDots({
  consultas,
  onSelect,
}: {
  consultas: readonly Consultation[];
  onSelect: (id: string) => void;
}) {
  // Más antigua primero: una línea de vida se lee de izquierda a derecha.
  const orden = useMemo(
    () => [...consultas].sort((a, b) => (a.fecha < b.fecha ? -1 : 1)),
    [consultas],
  );

  return (
    <div className="relative overflow-x-auto pb-1">
      <div className="relative flex min-w-max items-start gap-4 px-1 pt-1">
        {/* El hilo que une las estaciones. */}
        <span
          aria-hidden
          className="absolute left-1 right-1 top-[7px] h-px bg-line-strong"
        />
        {orden.map((c) => (
          <HoverHint
            key={c.id}
            label={`${STATUS_LABEL[c.estado]} · ${c.motivo || "sin motivo"}`}
          >
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              aria-label={`Consulta del ${MES_CORTO.format(new Date(c.fecha))}: ${STATUS_LABEL[c.estado]}`}
              className="relative flex flex-col items-center gap-1"
            >
              <span
                className={`h-3 w-3 rounded-full ring-2 ring-surface ${STATUS_BAR[c.estado]} transition-transform hover:scale-125 motion-reduce:hover:scale-100`}
              />
              <span className="data whitespace-nowrap text-[9px] text-muted">
                {MES_CORTO.format(new Date(c.fecha))}
              </span>
            </button>
          </HoverHint>
        ))}
      </div>
    </div>
  );
}
