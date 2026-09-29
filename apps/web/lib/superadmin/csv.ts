// Generador de CSV para las exportaciones de la consola.
//
// Sin dependencias: un CSV bien hecho son treinta líneas, y las librerías del
// ecosistema traen su propio parser además del serializador. Lo que NO es
// trivial son los cuatro detalles de abajo, que es justo por lo que esto vive
// en un módulo con pruebas en vez de estar embebido en cada route handler.

/** Caracteres que Excel interpreta como inicio de fórmula al abrir un CSV. */
const PREFIJOS_FORMULA = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Neutraliza la inyección de fórmulas (CSV injection).
 *
 * Excel evalúa una celda que empieza por `=`, `+`, `-` o `@`. Como `detalle` y
 * `actor_name` de audit_events son texto que escribieron personas, un evento con
 * `=HYPERLINK("http://…"&A1,"clic")` se convierte en una fuga de datos en cuanto
 * alguien abre el archivo. Anteponer una comilla simple hace que Excel lo trate
 * como texto; el resto de herramientas la muestran o la ignoran.
 */
function neutralizarFormula(texto: string): string {
  return PREFIJOS_FORMULA.some((prefijo) => texto.startsWith(prefijo)) ? `'${texto}` : texto;
}

/** Una celda: siempre entre comillas, con las comillas internas duplicadas. */
function celda(valor: unknown): string {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  return `"${neutralizarFormula(texto).replace(/"/g, '""')}"`;
}

export type OpcionesCsv = {
  /**
   * Separador de campos. Por defecto `;`.
   *
   * Excel NO usa el separador del archivo sino el "separador de listas" de la
   * configuración regional de Windows, que en español (es-CO, es-ES) es `;`.
   * Con `,` toda la fila aterriza en la columna A y el archivo parece roto.
   * Como esto es un producto en español para gente que abre el archivo en
   * Excel, `;` es el valor correcto — y `,` queda disponible para pandas o
   * Google Sheets.
   *
   * Deliberadamente NO se emite la línea `sep=;`: la entiende Excel y nadie más
   * (LibreOffice la muestra como una fila de datos).
   */
  separador?: string;
  /** Si se recortaron filas, se anuncia DENTRO del archivo. */
  truncadoEn?: { exportadas: number; total: number } | null;
};

/**
 * Serializa cabeceras + filas a un CSV listo para descargar.
 *
 * Empieza por BOM (U+FEFF): sin él, Excel en Windows lee el UTF-8 como ANSI y
 * "Nota generada por IA · Patología" pierde todos los acentos. Y usa CRLF,
 * que es lo que espera el mismo Excel.
 */
export function toCsv(
  cabeceras: string[],
  filas: unknown[][],
  opciones: OpcionesCsv = {},
): string {
  const sep = opciones.separador ?? ";";
  const lineas = [
    cabeceras.map(celda).join(sep),
    ...filas.map((fila) => fila.map(celda).join(sep)),
  ];

  // El aviso de truncamiento va dentro del archivo, no solo en la pantalla que
  // lo generó: el CSV se guarda, se reenvía y se analiza semanas después, y
  // para entonces nadie recuerda que la vista avisaba de un tope.
  if (opciones.truncadoEn) {
    const { exportadas, total } = opciones.truncadoEn;
    lineas.push(
      [
        celda("TRUNCADO"),
        celda(
          `Se exportaron ${exportadas} de ${total} filas. Acota el rango de fechas o los filtros.`,
        ),
      ].join(sep),
    );
  }

  return `﻿${lineas.join("\r\n")}\r\n`;
}

/** Nombre de archivo seguro: sin espacios ni caracteres que Windows rechace. */
export function nombreArchivoCsv(prefijo: string, sufijo: string): string {
  const limpio = `${prefijo}-${sufijo}`.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `${limpio}.csv`;
}

/**
 * Cabeceras de respuesta para una descarga de CSV.
 * `no-store` porque el contenido depende de los filtros y del rol de quien pide.
 */
export function cabecerasCsv(nombreArchivo: string): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    "Cache-Control": "no-store",
  };
}
