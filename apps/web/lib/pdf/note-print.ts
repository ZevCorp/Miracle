// El documento imprimible de la nota clínica.
//
// Extraído de app/app/consultas/[id]/page.tsx SIN cambios de contenido: ahora
// el panel rápido (ConsultationPeek) también imprime, y la única alternativa
// era duplicar ~120 líneas de plantilla. El HTML es un documento que se
// archiva en la historia clínica — cualquier cambio aquí sale impreso en las
// dos superficies a la vez, que es exactamente lo que se quiere.

import type { Consultation, Patient } from "@/lib/mock";
import {
  letterheadLines,
  responsableLabelDe,
  type OrgSettings,
} from "@/lib/hospital/org";

export interface MedicoIdentidad {
  identificationNumber: string | null;
  professionalRegistration: string | null;
  honorific?: string | null;
  responsableLabel?: string | null;
}

export interface AddendumPrint {
  autor: string;
  fecha: string;
  contenido: string;
}

export interface NotePrintInput {
  consultation: Consultation;
  patient?: Patient;
  /** Identidad ya resuelta (paciente registrado manda sobre la de la nota).
   *  Mismo contrato laxo que PatientIdentity: undefined y null significan lo
   *  mismo aquí ("no hay dato"). */
  identidad: { nombre?: string | null; documento?: string | null };
  medicoNombre?: string | null;
  medicoIdentidad?: MedicoIdentidad | null;
  org: OrgSettings;
  demo: boolean;
  addenda?: readonly AddendumPrint[];
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const COMBINING_MARKS_RE = new RegExp("[\\u0300-\\u036f]", "g");

/** Quita tildes ("Patología" → "Patologia") — el sello del sistema del
 *  hospital muestra la especialidad sin acentos (p. ej. "PATOLOGIA"). */
function sinTildes(s: string): string {
  return s.normalize("NFD").replace(COMBINING_MARKS_RE, "");
}

/** DD/MM/AAAA, HH:MM a./p. m. — mismo formato que usa el sistema del
 *  hospital en su sello "Fecha y hora" (con ceros a la izquierda). */
function formatFechaResponsable(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  let h = d.getHours();
  const ampm = h >= 12 ? "p. m." : "a. m.";
  h = h % 12 || 12;
  const hh = String(h).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy}, ${hh}:${mi} ${ampm}`;
}

export function construirHtmlNota({
  consultation: c,
  patient,
  identidad,
  medicoNombre,
  medicoIdentidad,
  org,
  demo,
  addenda = [],
}: NotePrintInput): string {
  // Bloque final al estilo del sello que deja el sistema del hospital
  // ("Nota realizada por / Responsable / Identificación / Reg. Med. /
  // Especialidad").
  //
  // La cédula, el registro médico y el honorífico son datos PERSONALES del
  // profesional: no se pueden heredar de la institución, así que si el perfil
  // no los tiene el bloque sigue sin aparecer. La etiqueta de responsable sí
  // admite un valor institucional por defecto (Configuración) — era el único
  // de los cuatro que dejaba el bloque fuera para casi todo el equipo.
  const responsableLabel = responsableLabelDe(org, medicoIdentidad?.responsableLabel);
  const pieResponsable =
    medicoIdentidad?.honorific &&
    responsableLabel &&
    medicoIdentidad?.identificationNumber &&
    medicoIdentidad?.professionalRegistration
      ? `<div class="foot-responsable">
          <p>Nota realizada por: ${esc(medicoIdentidad.honorific)}. ${esc(
            medicoNombre ?? "",
          )}${
            // El nombre de la institución viene de Configuración. Antes esta
            // línea decía "Hospital General de Medellín" literalmente, así que
            // CUALQUIER institución imprimía sus notas con ese nombre.
            org.name ? ` Empresa: ${esc(org.name)}` : ""
          } Fecha y hora: ${esc(formatFechaResponsable(c.fecha))}</p>
          <p><strong>Responsable:</strong> ${esc(responsableLabel)}</p>
          <p><strong>Identificación:</strong> CC${esc(medicoIdentidad.identificationNumber)}</p>
          <p><strong>Reg. Med.:</strong> ${esc(medicoIdentidad.professionalRegistration)}</p>
          <p><strong>Especialidad:</strong> ${esc(sinTildes(c.especialidad).toUpperCase())}</p>
        </div>`
      : "";

  // Encabezado institucional. Hasta ahora el documento no llevaba ningún dato
  // de la institución: el único texto institucional era el nombre de Miracle
  // en el pie, en un papel que se archiva en la historia clínica.
  const lineasEncabezado = letterheadLines(org);
  const membrete =
    org.name || lineasEncabezado.length
      ? `<div class="membrete">
          ${org.name ? `<p class="membrete-nombre">${esc(org.name)}</p>` : ""}
          ${
            lineasEncabezado.length
              ? `<p class="membrete-datos">${lineasEncabezado.map(esc).join(" · ")}</p>`
              : ""
          }
        </div>`
      : "";
  const aceptados = c.codigos.filter((k) => k.estado === "aceptado");
  const secciones = c.note
    .map((s) => {
      const cuerpo =
        s.kind === "lista" && s.items?.length
          ? `<ul>${s.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`
          : `<p>${esc(s.texto ?? "")}</p>`;
      return `<section><h2>${esc(s.titulo)}</h2>${cuerpo}</section>`;
    })
    .join("");
  const codigos = aceptados.length
    ? `<table><thead><tr><th>Sistema</th><th>Código</th><th>Descripción</th></tr></thead><tbody>${aceptados
        .map(
          (k) =>
            `<tr><td>${esc(k.sistema)}</td><td>${esc(k.codigo)}</td><td>${esc(k.descripcion)}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : `<p class="muted">Sin códigos aceptados.</p>`;
  const fecha = new Date(c.fecha).toLocaleString("es-CO");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Nota clínica · ${esc(
    identidad.nombre ?? "Paciente",
  )}</title><style>
      *{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0e1726;margin:40px;line-height:1.5}
      h1{font-size:20px;margin:0 0 2px}h2{font-size:14px;margin:18px 0 4px;color:#0c1424;text-transform:uppercase;letter-spacing:.02em}
      .muted{color:#64748b;font-size:12px}.head{border-bottom:2px solid #0c1424;padding-bottom:10px;margin-bottom:8px}
      .grid{display:flex;flex-wrap:wrap;gap:4px 24px;font-size:13px;margin-top:6px}
      section p,section ul{font-size:13px;margin:2px 0}ul{padding-left:18px}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
      th,td{border:1px solid #cbd5e1;padding:5px 8px;text-align:left}th{background:#f1f5f9}
      .foot{margin-top:28px;border-top:1px solid #cbd5e1;padding-top:10px;font-size:11px;color:#64748b}
      .foot-responsable{margin-top:14px;font-size:12px;color:#0e1726}
      .foot-responsable p{margin:3px 0}
      .foot-responsable strong{display:inline-block;min-width:100px}
      .membrete{margin-bottom:14px}
      .membrete-nombre{margin:0;font-size:13px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:#0c1424}
      .membrete-datos{margin:2px 0 0;font-size:11px;color:#64748b}
      @media print{body{margin:18mm}}
    </style></head><body>
      ${
        demo
          ? `<div style="border:2px solid #a34a06;background:#fdeecf;color:#7c3a05;padding:8px 12px;margin-bottom:14px;font-weight:700;font-size:13px">DOCUMENTO DE DEMOSTRACIÓN — generado a partir de una conversación simulada. No válido como historia clínica.</div>`
          : ""
      }
      ${membrete}
      <div class="head">
        <h1>${esc(identidad.nombre ?? "Paciente sin identificar")}</h1>
        <div class="grid">
          ${
            patient && patient.edad > 0
              ? `<span>${patient.edad} años${patient.sexo ? ` · ${patient.sexo === "F" ? "Femenino" : "Masculino"}` : ""}</span>`
              : ""
          }
          ${identidad.documento ? `<span>Doc: ${esc(identidad.documento)}</span>` : ""}
          <span>${esc(c.especialidad)} · ${esc(c.servicio)}</span>
          <span>${esc(medicoNombre ?? "")}</span>
          ${
            medicoIdentidad?.identificationNumber || medicoIdentidad?.professionalRegistration
              ? `<span>${esc(
                  [
                    medicoIdentidad.identificationNumber
                      ? `CC ${medicoIdentidad.identificationNumber}`
                      : null,
                    medicoIdentidad.professionalRegistration
                      ? `Reg. Med. ${medicoIdentidad.professionalRegistration}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                )}</span>`
              : ""
          }
          <span>${esc(fecha)}</span>
        </div>
      </div>
      ${secciones}
      <h2>Codificación</h2>${codigos}
      ${
        addenda.length
          ? `<h2>Adendas</h2>${addenda
              .map(
                (a) =>
                  `<section><p class="muted">${esc(a.autor)} · ${esc(
                    new Date(a.fecha).toLocaleString("es-CO"),
                  )}</p><p>${esc(a.contenido)}</p></section>`,
              )
              .join("")}<p class="muted">Adenda a nota firmada — no modifica el documento original.</p>`
          : ""
      }
      <p class="foot">${
        // El documento es de la institución, no del proveedor: su nombre va
        // primero y Miracle queda como la herramienta con la que se generó.
        org.name ? `${esc(org.name)} · ` : ""
      }Documento generado con asistencia de IA y revisado por el profesional de salud. Generado con Miracle.</p>
      ${pieResponsable}
    </body></html>`;
}

/** Abre la ventana de impresión con el documento. `onBlocked` avisa cuando el
 *  navegador bloquea la ventana emergente (el único fallo posible aquí). */
export function abrirImpresionNota(input: NotePrintInput, onBlocked: () => void) {
  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) {
    onBlocked();
    return;
  }
  w.document.write(construirHtmlNota(input));
  w.document.close();
  w.focus();
  w.print();
}
