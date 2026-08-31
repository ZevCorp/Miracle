"use client";

import Link from "next/link";
import { TYPE_LABEL, type Consultation, type NoteSection } from "@/lib/mock";
import { formatFechaRelativa } from "@/lib/dates";
import { useStore } from "@/app/app/providers";
import { Avatar } from "@/components/ui/Avatar";
import { resolveConsultationIdentity } from "@/lib/clinical/patient-identity";
import { usePeekClick } from "@/components/app/PeekProvider";
import { StatusBadge } from "./StatusBadge";

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
  peekIds,
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
  /** Con lista de ids, el clic abre el panel rápido en vez de navegar
   *  (⌘-clic sigue navegando). Sin ella, la tarjeta navega como siempre. */
  peekIds?: readonly string[];
  /** El rótulo es el número de caso de un laboratorio: solo tiene sentido en una
   *  institución. En un consultorio personal (B2C) no existe y no se muestra. */
  showRotulo?: boolean;
}) {
  const { getPatient } = useStore();
  const rotulo = showRotulo ? (rotuloProp ?? rotuloDe(consultation.note)) : undefined;

  // La identidad se busca de lo más fiable a lo menos: un paciente registrado y
  // asociado a mano manda sobre la identificación que quedó en la nota.
  //
  // Esta tarjeta NO vuelve a buscar el nombre dentro de la nota: lee el dato ya
  // resuelto (columnas `paciente_nombre` / `paciente_documento`, que sincroniza
  // la base y el store trae al cargar). Cuando cada pantalla lo extraía por su
  // cuenta, la misma consulta podía aparecer con un nombre en la lista y sin él
  // en el dashboard.
  const identidad = resolveConsultationIdentity(
    getPatient(consultation.pacienteId),
    consultation,
  );
  const nombre = patientName ?? identidad.nombre;
  const documento = identidad.documento;

  const abrirPeek = usePeekClick(
    { kind: "consultation", id: consultation.id },
    peekIds,
  );

  return (
    <Link
      href={`/app/consultas/${consultation.id}`}
      onClick={peekIds ? abrirPeek : undefined}
      data-light
      className={`block transition-[color,background-color,border-color,box-shadow,transform] duration-150 ${
        presentation === "row"
          ? "clinical-list-row px-1 py-3.5"
          : "rounded-[16px] border bg-surface p-4 shadow-[var(--elev-1)] hover:-translate-y-0.5 hover:border-mist hover:bg-ice-soft/40 hover:shadow-[var(--elev-2)] motion-reduce:hover:translate-y-0"
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

    </Link>
  );
}
