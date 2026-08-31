"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Check,
  Loader2,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useStore } from "@/app/app/providers";
import {
  AgendaQuickAdd,
  ImportarFotoModal,
  type UseAgendaHoy,
} from "@/components/app/AgendaHoy";
import { SectionRule } from "@/components/app/AppPage";
import { usePeekClick } from "@/components/app/PeekProvider";
import { STATUS_BAR } from "@/components/app/StatusBadge";
import { resolveConsultationIdentity } from "@/lib/clinical/patient-identity";
import { ZONA_CLINICA, esDeHoy } from "@/lib/dates";
import { STATUS_LABEL, type Consultation } from "@/lib/mock";
import type { Appointment } from "@/lib/agenda";

/**
 * EL RIEL DEL DÍA: la agenda y las consultas hechas, FUSIONADAS en una sola
 * línea de tiempo con la marca "AHORA" moviéndose entre ellas.
 *
 * Antes eran dos cajas separadas ("Agenda de hoy" y consultas por otro lado) y
 * el médico tenía que reconstruir su día mentalmente. Aquí el día se LEE:
 * lo atendido arriba (atenuado), el ahora en el medio, lo que viene abajo.
 *
 * DEDUPE: una cita atendida vía «Iniciar» produce cita + consulta del mismo
 * encuentro (appointments.clinical_encounter_id === consultations.id, la
 * identidad la garantiza encounter-to-consultation). Se pinta SOLO la
 * consulta: es la que tiene la nota. Sin ese vínculo no se adivina nada.
 *
 * Nota de zona: las citas usan la fecha del dispositivo (todayLocalISO) y las
 * consultas la zona clínica de Bogotá (esDeHoy). En Colombia coinciden;
 * costura preexistente documentada, no de este riel.
 */

type Fila =
  | { tipo: "cita"; hora: string; cita: Appointment }
  | { tipo: "consulta"; hora: string; consulta: Consultation };

const HORA_CONSULTA = new Intl.DateTimeFormat("es-CO", {
  timeZone: ZONA_CLINICA,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function DayFlow({
  ahora,
  agenda,
}: {
  ahora: Date | null;
  agenda: UseAgendaHoy;
}) {
  const { consultations, getPatient } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const consultasHoy = useMemo(
    () => consultations.filter((c) => esDeHoy(c.fecha)),
    [consultations],
  );

  const filas = useMemo<Fila[]>(() => {
    const idsConsultas = new Set(consultasHoy.map((c) => c.id));
    const citas: Fila[] = agenda.citas
      .filter(
        (c) => !(c.clinicalEncounterId && idsConsultas.has(c.clinicalEncounterId)),
      )
      .map((c) => ({ tipo: "cita", hora: c.hora, cita: c }));
    const cons: Fila[] = consultasHoy.map((c) => ({
      tipo: "consulta",
      hora: HORA_CONSULTA.format(new Date(c.fecha)),
      consulta: c,
    }));
    return [...citas, ...cons].sort((a, b) => a.hora.localeCompare(b.hora));
  }, [agenda.citas, consultasHoy]);

  const horaAhora = ahora ? HORA_CONSULTA.format(ahora) : null;
  // "AHORA" va después de la última fila cuya hora ya pasó.
  const indiceAhora = horaAhora
    ? filas.filter((f) => f.hora <= horaAhora).length
    : -1;

  const idsConsultasVisibles = useMemo(
    () => filas.filter((f) => f.tipo === "consulta").map((f) => (f as Extract<Fila, { tipo: "consulta" }>).consulta.id),
    [filas],
  );

  return (
    <section>
      <SectionRule
        title="Tu día"
        count={filas.length || undefined}
        action={
          agenda.dbLista ? (
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowAdd((v) => !v)}
                className="clinical-tertiary min-h-9 px-2.5 text-[13px]"
              >
                <Plus size={14} /> Agregar
              </button>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="clinical-tertiary min-h-9 px-2.5 text-[13px]"
              >
                <Camera size={14} /> Importar
              </button>
            </span>
          ) : undefined
        }
      />

      {showAdd ? (
        <AgendaQuickAdd onAgregar={agenda.agregar} onClose={() => setShowAdd(false)} />
      ) : null}

      {agenda.cargando ? (
        <div className="clinical-panel flex justify-center py-6">
          <Loader2 size={18} className="animate-spin text-muted" />
        </div>
      ) : filas.length === 0 ? (
        <p className="clinical-panel px-4 py-3.5 text-sm text-muted">
          {agenda.dbLista
            ? "El día está limpio: sin citas ni consultas todavía. Agrega la agenda o mantén el orbe para empezar."
            : "La agenda no está disponible; aquí verás las consultas que grabes hoy."}
        </p>
      ) : (
        <ol className="stagger-in relative space-y-0.5">
          {filas.map((fila, i) => (
            <FilaConMarca
              key={fila.tipo === "cita" ? `a-${fila.cita.id}` : `c-${fila.consulta.id}`}
              conAhora={i === indiceAhora && indiceAhora < filas.length}
            >
              {fila.tipo === "cita" ? (
                <FilaCita
                  cita={fila.cita}
                  confirmId={confirmId}
                  setConfirmId={setConfirmId}
                  marcarAtendida={agenda.marcarAtendida}
                  eliminar={agenda.eliminar}
                />
              ) : (
                <FilaConsulta
                  consulta={fila.consulta}
                  listIds={idsConsultasVisibles}
                  getPatient={getPatient}
                />
              )}
            </FilaConMarca>
          ))}
          {/* AHORA al final del día: todo lo listado ya pasó. */}
          {indiceAhora >= filas.length ? <MarcaAhora hora={horaAhora} /> : null}
        </ol>
      )}

      {importOpen ? (
        <ImportarFotoModal
          fecha={agenda.hoy}
          onClose={() => setImportOpen(false)}
          onImported={agenda.onImported}
        />
      ) : null}
    </section>
  );
}

function FilaConMarca({
  conAhora,
  children,
}: {
  conAhora: boolean;
  children: React.ReactNode;
}) {
  return (
    <li>
      {conAhora ? <MarcaAhora /> : null}
      {children}
    </li>
  );
}

/** La línea del presente: cruza el riel a la altura de la hora actual. */
function MarcaAhora({ hora }: { hora?: string | null }) {
  return (
    <div aria-hidden className="flex items-center gap-2 py-1.5">
      <span className="data rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
        Ahora{hora ? ` · ${hora}` : ""}
      </span>
      <span className="h-px flex-1 bg-accent/50" />
    </div>
  );
}

function FilaCita({
  cita,
  confirmId,
  setConfirmId,
  marcarAtendida,
  eliminar,
}: {
  cita: Appointment;
  confirmId: string | null;
  setConfirmId: (id: string | null) => void;
  marcarAtendida: (id: string) => Promise<void>;
  eliminar: (id: string) => Promise<void>;
}) {
  const cancelada = cita.estado === "cancelada";
  const atendida = cita.estado === "atendida";
  const enCurso = cita.estado === "en_curso";
  const apagada = cancelada || atendida;

  return (
    <div
      className={`clinical-panel flex items-center gap-3 px-3.5 py-2.5 ${
        enCurso ? "border-warning/40 bg-warning-soft/40" : ""
      } ${apagada ? "opacity-55" : ""}`}
      data-light
    >
      <span className="data w-12 shrink-0 text-[13px] font-semibold tabular-nums text-deep">
        {cita.hora}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm font-semibold ${
            cancelada ? "text-muted line-through" : "text-deep"
          }`}
        >
          {cita.pacienteNombre}
        </span>
        <span className="block truncate text-[12px] text-muted">
          {enCurso
            ? "Consulta en curso"
            : atendida
              ? "Atendida"
              : (cita.motivo ?? "Cita agendada")}
        </span>
      </span>

      {confirmId === cita.id ? (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setConfirmId(null);
              void eliminar(cita.id);
            }}
            className="rounded-full bg-danger px-3 py-1.5 text-xs font-semibold text-white"
          >
            Eliminar
          </button>
          <button
            type="button"
            onClick={() => setConfirmId(null)}
            aria-label="Cancelar eliminación"
            className="icon-btn h-9 w-9"
          >
            <X size={15} />
          </button>
        </span>
      ) : enCurso && cita.clinicalEncounterId ? (
        <Link
          href={`/app/consultas/en-vivo?encounter=${encodeURIComponent(cita.clinicalEncounterId)}&appointment=${encodeURIComponent(cita.id)}`}
          className="clinical-primary min-h-9 shrink-0 px-3.5 text-[13px]"
        >
          <Play size={14} /> Reanudar
        </Link>
      ) : cita.estado === "programada" ? (
        <span className="flex shrink-0 items-center gap-0.5">
          <Link
            href={`/app/consultas/nueva?appointment=${encodeURIComponent(cita.id)}`}
            title="Iniciar consulta"
            aria-label={`Iniciar consulta con ${cita.pacienteNombre}`}
            className="icon-btn h-9 w-9 text-accent"
          >
            <Play size={15} />
          </Link>
          <button
            type="button"
            onClick={() => void marcarAtendida(cita.id)}
            title="Marcar atendida"
            aria-label={`Marcar atendida la cita de ${cita.pacienteNombre}`}
            className="icon-btn h-9 w-9 hover:text-success"
          >
            <Check size={15} />
          </button>
          <button
            type="button"
            onClick={() => setConfirmId(cita.id)}
            title="Eliminar cita"
            aria-label={`Eliminar la cita de ${cita.pacienteNombre}`}
            className="icon-btn h-9 w-9 hover:text-danger"
          >
            <Trash2 size={15} />
          </button>
        </span>
      ) : !cancelada ? (
        <button
          type="button"
          onClick={() => setConfirmId(cita.id)}
          title="Eliminar cita"
          aria-label={`Eliminar la cita de ${cita.pacienteNombre}`}
          className="icon-btn h-9 w-9 hover:text-danger"
        >
          <Trash2 size={15} />
        </button>
      ) : null}
    </div>
  );
}

function FilaConsulta({
  consulta,
  listIds,
  getPatient,
}: {
  consulta: Consultation;
  listIds: readonly string[];
  getPatient: ReturnType<typeof useStore>["getPatient"];
}) {
  const abrirPeek = usePeekClick({ kind: "consultation", id: consulta.id }, listIds);
  const identidad = resolveConsultationIdentity(
    getPatient(consulta.pacienteId),
    consulta,
  );
  return (
    <Link
      href={`/app/consultas/${consulta.id}`}
      onClick={abrirPeek}
      className="clinical-panel flex items-center gap-3 px-3.5 py-2.5"
      data-light
    >
      <span className="data w-12 shrink-0 text-[13px] tabular-nums text-muted">
        {HORA_CONSULTA.format(new Date(consulta.fecha))}
      </span>
      <span
        aria-hidden
        className={`h-2 w-2 shrink-0 rounded-full ${STATUS_BAR[consulta.estado]}`}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-deep">
          {identidad.nombre ?? "Paciente sin identificar"}
        </span>
        <span className="block truncate text-[12px] text-muted">
          {consulta.motivo || STATUS_LABEL[consulta.estado]}
        </span>
      </span>
      <span className="shrink-0 text-[12px] font-medium text-muted">
        {STATUS_LABEL[consulta.estado]}
      </span>
    </Link>
  );
}
