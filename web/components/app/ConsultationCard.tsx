"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { TYPE_LABEL, type Consultation, type NoteSection } from "@/lib/mock";
import { formatFechaRelativa } from "@/lib/dates";
import { useStore } from "@/app/app/providers";
import { extractPatientIdentity } from "@/lib/clinical/patient-identity";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "./StatusBadge";
import { ConsultationCardPreview } from "./ConsultationCardPreview";

// Solo los campos que la tarjeta necesita; una Consultation completa también
// encaja (structural typing), pero así las páginas RSC pueden construir el objeto
// desde una fila de la base sin cargar todo el store.
export type CardConsultation = Pick<
  Consultation,
  "id" | "pacienteId" | "especialidad" | "tipo" | "estado" | "motivo" | "fecha"
> & {
  /** Opcional: solo lo traen las páginas que ya cargan la nota completa. */
  note?: readonly NoteSection[] | null;
  servicio?: string | null;
  resumen?: string | null;
  duracionMin?: number | null;
  /** Copias que la base extrae de la nota (ver la migración
   *  consultation_patient_identity). Las páginas RSC las traen ya resueltas;
   *  en el store se calculan desde `note`. */
  pacienteNombre?: string | null;
  pacienteDocumento?: string | null;
};

/** Espera antes de abrir la vista rápida: recorrer la lista con el cursor no
 *  debe disparar globos a cada paso. */
const RETARDO_MS = 350;

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
  showRotulo = true,
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
  /** El rótulo es el número de caso de un laboratorio: solo tiene sentido en una
   *  institución. En un consultorio personal (B2C) no existe y no se muestra. */
  showRotulo?: boolean;
}) {
  const { getPatient } = useStore();
  const rotulo = showRotulo ? (rotuloProp ?? rotuloDe(consultation.note)) : undefined;

  // La identidad se busca de lo más fiable a lo menos: un paciente registrado y
  // asociado a mano manda sobre cualquier cosa extraída de un texto.
  const identidadDeNota = consultation.pacienteNombre
    ? { nombre: consultation.pacienteNombre, documento: consultation.pacienteDocumento ?? undefined }
    : extractPatientIdentity(consultation.note);
  const pacienteRegistrado = getPatient(consultation.pacienteId);
  const nombre =
    patientName ?? pacienteRegistrado?.nombre ?? identidadDeNota.nombre ?? undefined;
  const documento =
    pacienteRegistrado?.documento ??
    consultation.pacienteDocumento ??
    identidadDeNota.documento ??
    undefined;

  // Rectángulo de la tarjeta en el momento de abrir: ancla la vista rápida.
  const [ancla, setAncla] = useState<DOMRect | null>(null);
  const temporizador = useRef<number | null>(null);

  function cancelarApertura() {
    if (temporizador.current !== null) {
      window.clearTimeout(temporizador.current);
      temporizador.current = null;
    }
  }

  function cerrar() {
    cancelarApertura();
    setAncla(null);
  }

  function alEntrar(e: React.MouseEvent<HTMLAnchorElement>) {
    // Solo con mouse real: en pantallas táctiles un "hover" es en realidad un
    // toque y el globo taparía la tarjeta que el dedo acaba de tocar.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const el = e.currentTarget;
    cancelarApertura();
    temporizador.current = window.setTimeout(() => {
      setAncla(el.getBoundingClientRect());
    }, RETARDO_MS);
  }

  useEffect(() => cancelarApertura, []);

  // Con el globo abierto, cualquier cosa que mueva la tarjeta invalida su
  // posición: se cierra en vez de quedar flotando en el sitio equivocado.
  useEffect(() => {
    if (!ancla) return;
    const cerrarGlobo = () => setAncla(null);
    const alPulsarTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrarGlobo();
    };
    window.addEventListener("scroll", cerrarGlobo, true);
    window.addEventListener("resize", cerrarGlobo);
    window.addEventListener("keydown", alPulsarTecla);
    return () => {
      window.removeEventListener("scroll", cerrarGlobo, true);
      window.removeEventListener("resize", cerrarGlobo);
      window.removeEventListener("keydown", alPulsarTecla);
    };
  }, [ancla]);

  return (
    <Link
      href={`/app/consultas/${consultation.id}`}
      onMouseEnter={alEntrar}
      onMouseLeave={cerrar}
      onClick={cerrar}
      className={`block transition-[color,background-color,border-color,box-shadow,transform] duration-150 ${
        presentation === "row"
          ? "clinical-list-row px-1 py-3.5"
          : "rounded-[14px] border bg-surface p-4 shadow-[var(--shadow-xs)] hover:-translate-y-0.5 hover:border-mist hover:bg-ice-soft/40 hover:shadow-[var(--shadow-md)] motion-reduce:hover:translate-y-0"
      } ${active ? "border-accent ring-1 ring-accent/30" : presentation === "card" ? "border-line" : ""}`}
    >
      {/* Misma cabecera que una ficha de paciente: quién es, no qué documento
          es. El documento va debajo del nombre porque es como se busca a una
          persona en Colombia. */}
      <div className="flex items-start gap-3">
        <Avatar name={nombre} size={presentation === "row" ? "sm" : "md"} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-deep">
            {nombre ?? "Paciente sin identificar"}
          </div>
          <div className="truncate text-[13px] text-muted">
            {documento ? `${documento} · ` : ""}
            {consultation.especialidad} · {TYPE_LABEL[consultation.tipo]}
          </div>
        </div>
        <StatusBadge estado={consultation.estado} />
      </div>

      <p className="mt-2.5 line-clamp-1 text-sm text-ink-soft">
        {consultation.motivo}
      </p>

      <div className="mt-2 flex items-center gap-2 text-[13px] text-muted">
        {rotulo ? (
          <span className="shrink-0 rounded-md bg-ice px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent-ink">
            {rotulo}
          </span>
        ) : null}
        <span className="truncate">{formatFechaRelativa(consultation.fecha)}</span>
      </div>

      {ancla ? (
        <ConsultationCardPreview
          consultation={consultation}
          patientName={nombre}
          documento={documento}
          rotulo={rotulo}
          anchorRect={ancla}
        />
      ) : null}
    </Link>
  );
}
