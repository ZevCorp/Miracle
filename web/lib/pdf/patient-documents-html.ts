/**
 * El pintor web de los papeles de la consulta (el modelo vive en
 * patient-documents.ts). Una ventana con el documento y window.print(): el
 * navegador lo guarda como PDF o lo manda a la impresora.
 *
 * LO QUE ARREGLA FRENTE AL PAPEL DE ANTES:
 *   - número de página y la institución en CADA hoja (margen de @page), no solo
 *     en la primera: una nota de tres hojas sueltas no decía de quién era;
 *   - el paciente en un bloque de datos con EPS, edad y sexo, no en una línea;
 *   - el plan y el egreso, que no salían impresos;
 *   - espacio para firma y sello, con registro médico debajo;
 *   - el cuerpo en serif, como la nota en pantalla: es un registro, no un panel.
 */

import type { Bloque, Documento } from "./patient-documents";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Una cadena para `content:` de CSS (margen de página). Va DENTRO de <style>:
 * un nombre de paciente con «</style>» cerraría la hoja de estilos y lo que
 * siguiera se ejecutaría como HTML. Por eso < y > salen como escapes de CSS
 * (\3c, \3e), además de comillas y barras.
 */
function cssString(s: string): string {
  const seguro = s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/</g, "\\3c ")
    .replace(/>/g, "\\3e ")
    .replace(/\n/g, " ");
  return `"${seguro}"`;
}

const COLORES_ALARMA: Record<string, { borde: string; fondo: string; tinta: string }> = {
  emergency: { borde: "#c0392b", fondo: "#fdecea", tinta: "#8e1f14" },
  priority: { borde: "#b7791f", fondo: "#fdf3e1", tinta: "#7a4a06" },
  monitor: { borde: "#3272e3", fondo: "#eef4fe", tinta: "#1a4fa0" },
  "": { borde: "#94a3b8", fondo: "#f3f6fa", tinta: "#0e1726" },
};

function valorOEspacio(valor: string): string {
  return valor ? esc(valor) : `<span class="blank" aria-label="Para completar a mano"></span>`;
}

function pintarBloque(b: Bloque): string {
  switch (b.tipo) {
    case "parrafo":
      return `<section class="bloque"><h2>${esc(b.titulo)}</h2><p class="cuerpo">${esc(b.texto)}</p></section>`;
    case "lista":
      return `<section class="bloque"><h2>${esc(b.titulo)}</h2><ul class="cuerpo">${b.items
        .map((i) => `<li>${esc(i)}</li>`)
        .join("")}</ul></section>`;
    case "medicamento":
      return `<section class="med"><div class="med-nombre"><span class="med-num">${b.numero}</span>${esc(
        b.nombre,
      )}</div><dl>${b.campos
        .map((c) => `<div><dt>${esc(c.etiqueta)}</dt><dd>${valorOEspacio(c.valor)}</dd></div>`)
        .join("")}</dl></section>`;
    case "alarma": {
      const c = COLORES_ALARMA[b.nivel] ?? COLORES_ALARMA[""];
      return `<section class="alarma" style="border-left-color:${c.borde};background:${c.fondo};color:${c.tinta}"><h3>${esc(
        b.titulo,
      )}:</h3><ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></section>`;
    }
    case "tabla":
      return `<section class="bloque"><h2>${esc(b.titulo)}</h2><table><thead><tr>${b.columnas
        .map((c) => `<th>${esc(c)}</th>`)
        .join("")}</tr></thead><tbody>${b.filas
        .map((f) => `<tr>${f.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table></section>`;
    case "aviso":
      return `<p class="aviso">${esc(b.texto)}</p>`;
    default:
      return "";
  }
}

export function documentoHtml(doc: Documento): string {
  const cabecera = [doc.membrete.nombre, doc.titulo].filter(Boolean).join(" · ");
  const paciente = doc.datos.find((d) => d.etiqueta === "Paciente")?.valor ?? "";

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(doc.titulo)} · ${esc(paciente)}</title><style>
  @page{size:letter;margin:20mm 18mm 20mm 18mm;
    @top-left{content:${cssString(cabecera)};font:500 8.5pt/1 -apple-system,"Segoe UI",Inter,Arial,sans-serif;color:#69778b}
    @top-right{content:${cssString(paciente)};font:500 8.5pt/1 -apple-system,"Segoe UI",Inter,Arial,sans-serif;color:#69778b}
    @bottom-left{content:${cssString(doc.pie)};font:400 7.5pt/1.3 -apple-system,"Segoe UI",Inter,Arial,sans-serif;color:#69778b}
    @bottom-right{content:"Página " counter(page) " de " counter(pages);font:500 8pt/1 -apple-system,"Segoe UI",Inter,Arial,sans-serif;color:#69778b}}
  @page:first{@top-left{content:none}@top-right{content:none}}
  *{box-sizing:border-box}
  body{margin:0;color:#0e1726;font:400 10.5pt/1.5 -apple-system,"Segoe UI",Inter,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @media screen{body{max-width:816px;margin:24px auto;padding:48px 56px;box-shadow:0 10px 40px rgba(14,23,38,.12);border-radius:12px}}
  .demo{border:2px solid #a34a06;background:#fdeecf;color:#7c3a05;padding:8px 12px;margin-bottom:14px;font-weight:700;font-size:10pt}
  header{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;padding-bottom:10px;border-bottom:2px solid #0c1424}
  .org-nombre{margin:0;font-size:11pt;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#0c1424}
  .org-datos{margin:3px 0 0;font-size:8.5pt;color:#5d6b80}
  .titulo{text-align:right}
  .titulo h1{margin:0;font-size:17pt;font-weight:650;letter-spacing:-.01em;color:#0c1424}
  .titulo p{margin:2px 0 0;font-size:9pt;color:#5d6b80}
  .datos{display:grid;grid-template-columns:1fr 1fr;gap:6px 28px;margin:14px 0 6px;padding:12px 14px;background:#f3f6fa;border-radius:8px}
  .datos div{display:flex;gap:8px;font-size:9.5pt;min-width:0}
  .datos dt{flex:0 0 88px;color:#5d6b80;font-size:8pt;font-weight:600;text-transform:uppercase;letter-spacing:.06em;padding-top:1.5pt}
  .datos dd{margin:0;font-weight:500}
  h2{font-size:8.5pt;font-weight:650;text-transform:uppercase;letter-spacing:.1em;color:#1a4fa0;margin:16px 0 4px;break-after:avoid}
  .cuerpo{font-family:"Source Serif 4",Georgia,"Times New Roman",serif;font-size:11pt;line-height:1.55;color:#191f28;margin:0;white-space:pre-wrap}
  ul.cuerpo{white-space:normal;padding-left:18px}ul.cuerpo li{margin:2px 0}
  .bloque{break-inside:avoid-page}
  .med{border:1px solid #d4dbe6;border-radius:8px;padding:10px 14px 8px;margin:12px 0;break-inside:avoid}
  .med-nombre{font-size:12pt;font-weight:650;color:#0c1424;display:flex;align-items:center;gap:10px}
  .med-num{display:inline-flex;width:20px;height:20px;border-radius:50%;background:#3272e3;color:#fff;font-size:9pt;align-items:center;justify-content:center}
  .med dl{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin:8px 0 0}
  .med dl div{display:flex;gap:8px;align-items:baseline;font-size:10pt}
  .med dt{flex:0 0 150px;color:#5d6b80;font-size:8.5pt}
  .med dd{margin:0;flex:1;font-weight:500}
  .blank{display:inline-block;width:100%;min-width:120px;border-bottom:1px solid #94a3b8;height:14px}
  .alarma{border-left:4px solid;border-radius:6px;padding:8px 14px;margin:10px 0;break-inside:avoid}
  .alarma h3{margin:0 0 4px;font-size:10.5pt}.alarma ul{margin:0;padding-left:18px}.alarma li{margin:2px 0}
  table{width:100%;border-collapse:collapse;font-size:9pt;margin-top:4px}
  th,td{border:1px solid #d4dbe6;padding:4px 8px;text-align:left}th{background:#f3f6fa}
  .aviso{margin:16px 0;padding:10px 14px;border:1px dashed #cbd5e1;border-radius:8px;color:#5d6b80;font-size:10pt}
  .firma{margin-top:44px;width:62%;break-inside:avoid}
  .firma .linea{border-top:1px solid #0c1424;padding-top:6px;font-weight:600}
  .firma p{margin:1px 0;font-size:9pt;color:#44546b}
  .sello{margin-top:18px;font-size:9pt;break-inside:avoid}.sello p{margin:2px 0}
  footer.pie{margin-top:22px;font-size:8pt;color:#69778b}
  @media print{footer.pie{display:none}}
</style></head><body>
  ${doc.demo ? `<div class="demo">DOCUMENTO DE DEMOSTRACIÓN — generado a partir de una conversación simulada. No válido como historia clínica.</div>` : ""}
  <header>
    <div>${doc.membrete.nombre ? `<p class="org-nombre">${esc(doc.membrete.nombre)}</p>` : ""}${
      doc.membrete.lineas.length ? `<p class="org-datos">${doc.membrete.lineas.map(esc).join(" · ")}</p>` : ""
    }</div>
    <div class="titulo"><h1>${esc(doc.titulo)}</h1>${
      doc.datos.find((d) => d.etiqueta === "Fecha") ? `<p>${esc(doc.datos.find((d) => d.etiqueta === "Fecha")!.valor)}</p>` : ""
    }</div>
  </header>
  <dl class="datos">${doc.datos
    .filter((d) => d.etiqueta !== "Fecha")
    .map((d) => `<div><dt>${esc(d.etiqueta)}</dt><dd>${esc(d.valor)}</dd></div>`)
    .join("")}</dl>
  ${doc.bloques.map(pintarBloque).join("")}
  ${
    doc.firma.nombre || doc.firma.lineas.length
      ? `<div class="firma"><div class="linea">${esc(doc.firma.nombre || "Firma del profesional")}</div>${doc.firma.lineas
          .map((l) => `<p>${esc(l)}</p>`)
          .join("")}</div>`
      : ""
  }
  ${doc.sello.length ? `<div class="sello">${doc.sello.map((l) => `<p>${esc(l)}</p>`).join("")}</div>` : ""}
  <footer class="pie">${esc(doc.pie)}</footer>
</body></html>`;
}

/**
 * Abre la ventana YA, en el mismo clic. Si se abriera después de un `await`
 * (p. ej. tras pedir el plan al backend), el navegador la bloquearía como
 * ventana emergente no pedida.
 */
export function abrirVentanaDeImpresion(): Window | null {
  const w = window.open("", "_blank", "width=860,height=1000");
  if (w) {
    w.document.write('<!doctype html><meta charset="utf-8"><title>Preparando…</title><p style="font:14px system-ui;color:#5d6b80;margin:40px">Preparando el documento…</p>');
  }
  return w;
}

/** Escribe el documento en una ventana ya abierta y abre el diálogo de imprimir. */
export function imprimirEn(w: Window, doc: Documento): void {
  w.document.open();
  w.document.write(documentoHtml(doc));
  w.document.close();
  w.focus();
  // Un cuadro para que el diseño asiente antes del diálogo.
  w.setTimeout(() => w.print(), 50);
}

/** Atajo: abrir e imprimir en el mismo clic, cuando no hay que esperar a nada. */
export function imprimirDocumento(doc: Documento, onBlocked: () => void): void {
  const w = abrirVentanaDeImpresion();
  if (!w) {
    onBlocked();
    return;
  }
  imprimirEn(w, doc);
}

/** "AAAA-MM-DDTHH:MM" en la hora local de este equipo, que es lo que el modelo espera. */
export function horaLocal(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
