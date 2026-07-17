// Informe de laboratorio en PDF — renderizador DETERMINISTA y reutilizable.
//
// Idea clave (pedido del usuario): el PDF NO se genera "desde cero" ni con IA cada vez. La
// IA corre una sola vez sobre la foto para rellenar las casillas; aquí solo se maqueta ese
// contenido ya guardado en un formato de informe de laboratorio. Re-descargar o cambiar una
// casilla vuelve a llamar a esta función con los valores guardados: cero tokens, cero IA.
//
// Igual que el resto de exportaciones de la app, usa HTML + window.print() (sin librerías de
// PDF): el usuario elige "Guardar como PDF" o imprime, y lo sube a su HIS.

export interface LabReportSection {
  label: string;
  content: string;
}

export interface LabReportInput {
  /** Título del informe (nombre de la plantilla), p. ej. "Informe de histopatología". */
  reportTitle: string;
  /** Fecha del informe en ISO; se formatea a es-CO. */
  dateISO: string;
  professional: {
    name: string;
    specialtyName?: string | null;
    registration?: string | null;
    city?: string | null;
  };
  patient?: {
    nombre?: string | null;
    documento?: string | null;
    edad?: number | null;
    sexo?: "F" | "M" | null;
  } | null;
  organizationName?: string | null;
  sections: LabReportSection[];
  /** Marca el documento como demostración (no válido como resultado real). */
  demo?: boolean;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatFecha(dateISO: string): string {
  const date = new Date(dateISO);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

function buildLabReportHtml(input: LabReportInput): string {
  const { professional, patient } = input;
  const fecha = formatFecha(input.dateISO);

  const patientBits: string[] = [];
  if (patient?.edad && patient.edad > 0) {
    patientBits.push(
      `${patient.edad} años${
        patient.sexo ? ` · ${patient.sexo === "F" ? "Femenino" : "Masculino"}` : ""
      }`,
    );
  }
  if (patient?.documento) patientBits.push(`Doc: ${esc(patient.documento)}`);

  const professionalBits = [
    professional.specialtyName ? esc(professional.specialtyName) : "",
    professional.registration ? `Registro: ${esc(professional.registration)}` : "",
    professional.city ? esc(professional.city) : "",
  ].filter(Boolean);

  const secciones = input.sections
    .map((section) => {
      const content = section.content.trim();
      const body = content
        ? `<p>${esc(content)}</p>`
        : `<p class="empty">Sin información registrada.</p>`;
      return `<section><h2>${esc(section.label)}</h2>${body}</section>`;
    })
    .join("");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(
    input.reportTitle,
  )} · ${esc(patient?.nombre ?? "Paciente")}</title><style>
    *{box-sizing:border-box}
    body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0e1726;margin:40px;line-height:1.5}
    .brand{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2px solid #0c1424;padding-bottom:12px}
    .brand .title{font-size:20px;font-weight:700;margin:0}
    .brand .kind{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;margin:0 0 2px}
    .brand .meta{text-align:right;font-size:12px;color:#64748b}
    .brand .meta strong{display:block;color:#0c1424;font-size:13px}
    .cols{display:flex;flex-wrap:wrap;gap:10px 32px;margin-top:12px}
    .block{min-width:220px}
    .block .lbl{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin:0 0 2px}
    .block .val{font-size:14px;font-weight:600;color:#0c1424;margin:0}
    .block .sub{font-size:12px;color:#475569;margin:2px 0 0}
    h2{font-size:13px;letter-spacing:.02em;margin:18px 0 4px;color:#0c1424;text-transform:uppercase}
    section p{font-size:13px;margin:2px 0;white-space:pre-wrap}
    section p.empty{color:#94a3b8;font-style:italic}
    .sign{margin-top:40px;display:flex;justify-content:space-between;gap:24px}
    .sign .line{flex:1;border-top:1px solid #0c1424;padding-top:6px;font-size:12px;color:#334155;max-width:320px}
    .foot{margin-top:26px;border-top:1px solid #cbd5e1;padding-top:10px;font-size:11px;color:#64748b}
    .demo{border:2px solid #a34a06;background:#fdeecf;color:#7c3a05;padding:8px 12px;margin-bottom:14px;font-weight:700;font-size:13px}
    @media print{body{margin:16mm}}
  </style></head><body>
    ${
      input.demo
        ? `<div class="demo">DOCUMENTO DE DEMOSTRACIÓN — no válido como resultado de laboratorio.</div>`
        : ""
    }
    <div class="brand">
      <div>
        <p class="kind">Informe de laboratorio</p>
        <h1 class="title">${esc(input.reportTitle)}</h1>
      </div>
      <div class="meta">
        <strong>${esc(input.organizationName ?? "Miracle")}</strong>
        ${fecha ? `<span>${esc(fecha)}</span>` : ""}
      </div>
    </div>

    <div class="cols">
      <div class="block">
        <p class="lbl">Paciente</p>
        <p class="val">${esc(patient?.nombre ?? "Paciente sin identificar")}</p>
        ${patientBits.length ? `<p class="sub">${patientBits.join(" · ")}</p>` : ""}
      </div>
      <div class="block">
        <p class="lbl">Profesional</p>
        <p class="val">${esc(professional.name || "—")}</p>
        ${professionalBits.length ? `<p class="sub">${professionalBits.join(" · ")}</p>` : ""}
      </div>
    </div>

    ${secciones}

    <div class="sign">
      <div class="line">
        Firma y sello del profesional<br>
        ${esc(professional.name || "")}${
          professional.registration ? ` · Registro ${esc(professional.registration)}` : ""
        }
      </div>
    </div>

    <p class="foot">Informe transcrito con asistencia de Miracle a partir de la hoja de trabajo del profesional y revisado por él. Miracle · Inteligencia clínica-operativa.</p>
  </body></html>`;
}

/**
 * Abre el informe en una ventana nueva y dispara la impresión / "Guardar como PDF".
 * Devuelve false si el navegador bloqueó la ventana emergente (el caller avisa al usuario).
 */
export function downloadLabReport(input: LabReportInput): boolean {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
  if (!popup) return false;
  popup.document.write(buildLabReportHtml(input));
  popup.document.close();
  popup.focus();
  // Pequeño respiro para que el layout se asiente antes de imprimir (igual que en el detalle).
  window.setTimeout(() => popup.print(), 250);
  return true;
}
