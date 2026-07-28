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
  /** Cédula y registro médico del profesional — la secretaria los necesita
   *  para llenar el "Responsable" del sistema del hospital. */
  medicoIdentificacion?: string | null;
  medicoRegistro?: string | null;
  addenda?: readonly ConsultationTextAddendum[];
}

/**
 * Bloque del documento. El texto plano y el HTML se arman DESDE ESTA MISMA
 * lista: así el contenido y el orden no pueden divergir entre "lo que se pega
 * con formato" y "lo que se pega en un campo de texto simple".
 */
type Bloque =
  | { tipo: "titulo"; texto: string }
  | { tipo: "texto"; texto: string }
  | { tipo: "lista"; items: string[] };

function bloquesDeConsulta(input: ConsultationTextInput): Bloque[] {
  const {
    patient,
    medicoNombre,
    medicoIdentificacion,
    medicoRegistro,
    especialidad,
    servicio,
    fecha,
    note,
    codigos,
    addenda,
  } = input;
  const bloques: Bloque[] = [];

  bloques.push({ tipo: "texto", texto: patient?.nombre ?? "Paciente sin identificar" });
  const datos: string[] = [];
  if (patient && patient.edad > 0) {
    datos.push(
      `${patient.edad} años${patient.sexo ? ` · ${patient.sexo === "F" ? "Femenino" : "Masculino"}` : ""}`,
    );
  }
  if (patient?.documento) datos.push(`Doc: ${patient.documento}`);
  datos.push(`${especialidad} · ${servicio}`);
  if (medicoNombre) datos.push(medicoNombre);
  const identidad = [
    medicoIdentificacion ? `CC ${medicoIdentificacion}` : null,
    medicoRegistro ? `Reg. Med. ${medicoRegistro}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (identidad) datos.push(identidad);
  datos.push(new Date(fecha).toLocaleString("es-CO"));
  bloques.push({ tipo: "texto", texto: datos.join(" · ") });

  for (const s of note) {
    bloques.push({ tipo: "titulo", texto: s.titulo });
    if (s.kind === "lista" && s.items?.length) {
      bloques.push({ tipo: "lista", items: [...s.items] });
    } else {
      bloques.push({ tipo: "texto", texto: s.texto ?? "" });
    }
  }

  bloques.push({ tipo: "titulo", texto: "Codificación" });
  const aceptados = codigos.filter((k) => k.estado === "aceptado");
  if (aceptados.length) {
    for (const k of aceptados) {
      bloques.push({
        tipo: "texto",
        texto: `${k.sistema} ${k.codigo} — ${k.descripcion}`,
      });
    }
  } else {
    bloques.push({ tipo: "texto", texto: "Sin códigos aceptados." });
  }

  if (addenda?.length) {
    bloques.push({ tipo: "titulo", texto: "Adendas" });
    for (const a of addenda) {
      bloques.push({
        tipo: "texto",
        texto: `${a.autor} · ${new Date(a.fecha).toLocaleString("es-CO")}`,
      });
      bloques.push({ tipo: "texto", texto: a.contenido });
    }
    bloques.push({
      tipo: "texto",
      texto: "Adenda a nota firmada — no modifica el documento original.",
    });
  }

  return bloques;
}

/**
 * Texto plano con el mismo contenido y orden que el PDF: encabezado
 * (paciente, especialidad/servicio, médico, fecha), cada sección de la nota,
 * códigos aceptados y adendas (si existen).
 *
 * Los títulos van en MAYÚSCULA: es lo único del formato que sobrevive a un
 * campo de texto simple (la negrilla necesita HTML, ver buildConsultationHtml).
 */
export function buildConsultationPlainText(input: ConsultationTextInput): string {
  const lines: string[] = [];
  for (const b of bloquesDeConsulta(input)) {
    if (b.tipo === "titulo") {
      // Línea en blanco antes de cada título, salvo al inicio del documento.
      if (lines.length) lines.push("");
      lines.push(b.texto.toUpperCase());
    } else if (b.tipo === "lista") {
      for (const item of b.items) lines.push(`- ${item}`);
    } else {
      lines.push(b.texto);
    }
  }
  return lines.join("\n").trimEnd();
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Párrafo HTML respetando los saltos de línea internos del contenido. */
function parrafo(texto: string): string {
  return `<p>${escHtml(texto).replace(/\n/g, "<br>")}</p>`;
}

/**
 * Mismo documento que `buildConsultationPlainText`, en HTML y con los títulos
 * de sección en negrilla + mayúscula.
 *
 * Se usa junto al texto plano al copiar: si el destino acepta texto con
 * formato (Word, correo, un editor enriquecido del HIS) pega con negrilla; si
 * es un campo de texto simple, el navegador usa la versión plana, donde los
 * títulos igual quedan en mayúscula.
 */
export function buildConsultationHtml(input: ConsultationTextInput): string {
  const partes: string[] = [];
  for (const b of bloquesDeConsulta(input)) {
    if (b.tipo === "titulo") {
      partes.push(`<p><strong>${escHtml(b.texto.toUpperCase())}</strong></p>`);
    } else if (b.tipo === "lista") {
      partes.push(
        `<ul>${b.items.map((i) => `<li>${escHtml(i)}</li>`).join("")}</ul>`,
      );
    } else if (b.texto.trim()) {
      partes.push(parrafo(b.texto));
    }
  }
  return `<div>${partes.join("")}</div>`;
}

/**
 * Copia al portapapeles con respaldo `execCommand` para navegadores donde
 * `navigator.clipboard` no está disponible (equipos de hospital con
 * políticas de TI restrictivas) — mismo patrón ya usado en la consulta en
 * vivo (`app/app/consultas/en-vivo/page.tsx`), generalizado aquí para
 * reutilizarlo desde cualquier botón "Copiar".
 */
/**
 * Copia CON FORMATO: pone en el portapapeles la versión HTML (con negrillas) y
 * la de texto plano a la vez, y deja que el destino elija la que entienda.
 *
 * Por qué así: `writeText` solo lleva texto plano — la negrilla se pierde sí o
 * sí. La única vía es `ClipboardItem` con los dos tipos MIME. Si el navegador
 * no lo soporta o lo bloquea (equipos de hospital con políticas estrictas), se
 * cae al copiado plano de siempre: se pierde la negrilla, pero el contenido y
 * las mayúsculas de los títulos llegan igual.
 */
export async function copyRichTextWithFallback(
  html: string,
  plain: string,
): Promise<boolean> {
  if (!plain.trim()) return false;
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        }),
      ]);
      return true;
    } catch {
      // sigue al respaldo en texto plano
    }
  }
  return copyTextWithFallback(plain);
}

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
