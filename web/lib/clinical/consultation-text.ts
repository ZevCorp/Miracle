// Serializador de consultas a texto plano — una sola fuente de verdad para
// que "Copiar nota" (cualquier rol) y el PDF clínico (`descargarPDF` en
// app/app/consultas/[id]/page.tsx) nunca diverjan en contenido.

import type { ClinicalCode, NoteSection } from "@/lib/mock";

export interface ConsultationTextPatient {
  nombre: string;
  edad: number;
  sexo: "F" | "M" | null;
  documento: string;
}

export interface ConsultationTextAddendum {
  autor: string;
  fecha: string; // ISO
  contenido: string;
}

/** Forma mínima que necesita el serializador; la satisface `Consultation` + lo ya cargado en el detalle. */
export interface ConsultationTextInput {
  especialidad: string;
  servicio: string;
  fecha: string; // ISO
  note: readonly NoteSection[];
  codigos: readonly ClinicalCode[];
  patient?: ConsultationTextPatient | null;
  medicoNombre?: string | null;
  addenda?: readonly ConsultationTextAddendum[];
}

/**
 * Texto plano con el mismo contenido y orden que el PDF: encabezado
 * (paciente, especialidad/servicio, médico, fecha), cada sección de la nota,
 * códigos aceptados y adendas (si existen).
 */
export function buildConsultationPlainText(input: ConsultationTextInput): string {
  const { patient, medicoNombre, especialidad, servicio, fecha, note, codigos, addenda } = input;
  const lines: string[] = [];

  lines.push(patient?.nombre ?? "Paciente sin identificar");
  const datos: string[] = [];
  if (patient && patient.edad > 0) {
    datos.push(
      `${patient.edad} años${patient.sexo ? ` · ${patient.sexo === "F" ? "Femenino" : "Masculino"}` : ""}`,
    );
  }
  if (patient?.documento) datos.push(`Doc: ${patient.documento}`);
  datos.push(`${especialidad} · ${servicio}`);
  if (medicoNombre) datos.push(medicoNombre);
  datos.push(new Date(fecha).toLocaleString("es-CO"));
  lines.push(datos.join(" · "), "");

  for (const s of note) {
    lines.push(s.titulo);
    if (s.kind === "lista" && s.items?.length) {
      for (const item of s.items) lines.push(`- ${item}`);
    } else {
      lines.push(s.texto ?? "");
    }
    lines.push("");
  }

  lines.push("Codificación");
  const aceptados = codigos.filter((k) => k.estado === "aceptado");
  if (aceptados.length) {
    for (const k of aceptados) lines.push(`${k.sistema} ${k.codigo} — ${k.descripcion}`);
  } else {
    lines.push("Sin códigos aceptados.");
  }

  if (addenda?.length) {
    lines.push("", "Adendas");
    for (const a of addenda) {
      lines.push(`${a.autor} · ${new Date(a.fecha).toLocaleString("es-CO")}`, a.contenido, "");
    }
    lines.push("Adenda a nota firmada — no modifica el documento original.");
  }

  return lines.join("\n").trimEnd();
}

/**
 * Copia al portapapeles con respaldo `execCommand` para navegadores donde
 * `navigator.clipboard` no está disponible (equipos de hospital con
 * políticas de TI restrictivas) — mismo patrón ya usado en la consulta en
 * vivo (`app/app/consultas/en-vivo/page.tsx`), generalizado aquí para
 * reutilizarlo desde cualquier botón "Copiar".
 */
export async function copyTextWithFallback(text: string): Promise<boolean> {
  if (!text.trim()) return false;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // sigue al respaldo
    }
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
