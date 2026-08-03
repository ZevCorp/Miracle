// Formato de fechas para la UI, anclado a la zona horaria de la operación.
//
// POR QUÉ UNA ZONA FIJA Y NO LA DEL DISPOSITIVO
// Estos helpers los llaman sobre todo *server components* (toda la consola de
// super-admin, las listas de consultas, las auditorías). En el servidor "local"
// es la zona del runtime — UTC en Vercel —, así que una consulta de las 21:00
// en Bogotá se mostraba como las 02:00 del día siguiente, y `esDeHoy` cambiaba
// de día a las 19:00. Además el SQL YA agrupa por día de Bogotá
// (`(fecha at time zone 'America/Bogota')::date` en superadmin_dashboard), así
// que la gráfica y las tablas de al lado nunca cuadraban.
//
// Con la zona fija, servidor y navegador imprimen exactamente lo mismo — lo que
// de paso elimina el desajuste de hidratación de los componentes cliente que
// usan estos helpers (ConsultationCard, Timeline).
//
// Miracle opera en Colombia, zona única y sin horario de verano. Si algún día
// hay operación fuera del país, esto pasa a ser una preferencia por
// organización; hasta entonces, una constante es más honesta que `undefined`.

export const ZONA_CLINICA = "America/Bogota";

// Un solo formateador reutilizado: construir un Intl.DateTimeFormat es caro y
// estas funciones se llaman una vez por fila de tabla.
//
// Se piden las partes por separado en vez de confiar en el patrón corto de un
// locale (p. ej. "en-CA" para YYYY-MM-DD): ese patrón es dato de ICU y puede
// cambiar entre versiones de Node. Las partes son estables.
const PARTES_FECHA = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA_CLINICA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const FORMATO_HORA = new Intl.DateTimeFormat("es-CO", {
  timeZone: ZONA_CLINICA,
  hour: "2-digit",
  minute: "2-digit",
  // `hourCycle: "h23"` y no `hour12: false`: con hour12 varias builds de ICU
  // imprimen la medianoche como "24:05" en vez de "00:05".
  hourCycle: "h23",
});

type PartesFecha = { anio: number; mes: number; dia: number };

/** Año/mes/día de un instante, vistos desde la zona clínica. */
function partesZona(d: Date): PartesFecha {
  const partes = PARTES_FECHA.formatToParts(d);
  const leer = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(partes.find((p) => p.type === tipo)?.value ?? "0");
  return { anio: leer("year"), mes: leer("month"), dia: leer("day") };
}

/**
 * Clave "YYYY-MM-DD" del día en la zona clínica: la MISMA que produce el SQL
 * con `(fecha at time zone 'America/Bogota')::date`. Exportada porque el
 * validador de rangos y el nombre de los CSV necesitan "hoy en Bogotá" y no
 * deben volver a derivarlo por su cuenta.
 */
export function claveDiaZona(d: Date): string {
  const { anio, mes, dia } = partesZona(d);
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Número de día absoluto en la zona clínica, para restar días de CALENDARIO.
 * Se pasa por Date.UTC (donde todos los días miden 24 h exactas) en vez de
 * restar instantes: así "ayer" no depende de cuántas horas hayan pasado.
 */
function indiceDiaZona(d: Date): number {
  const { anio, mes, dia } = partesZona(d);
  return Date.UTC(anio, mes - 1, dia) / 86_400_000;
}

/** Hora "HH:mm" (24 h) de una fecha ISO, en la zona clínica. */
export function formatHora(iso: string): string {
  return FORMATO_HORA.format(new Date(iso));
}

/** true si el ISO cae hoy (día de calendario en la zona clínica). */
export function esDeHoy(iso: string): boolean {
  return claveDiaZona(new Date(iso)) === claveDiaZona(new Date());
}

/**
 * Etiqueta relativa: "Hoy · 14:30", "Ayer · 10:20", "18/06 · 22:38", y
 * "18/06/2025 · 22:38" cuando el año difiere del actual (evita ambigüedad con
 * más de un año de historia).
 */
export function formatFechaRelativa(iso: string): string {
  const objetivo = new Date(iso);
  const ahora = new Date();
  const diffDias = indiceDiaZona(ahora) - indiceDiaZona(objetivo);
  const hora = formatHora(iso);

  if (diffDias === 0) return `Hoy · ${hora}`;
  if (diffDias === 1) return `Ayer · ${hora}`;

  const { anio, mes, dia } = partesZona(objetivo);
  const dd = String(dia).padStart(2, "0");
  const mm = String(mes).padStart(2, "0");
  const fecha = anio === partesZona(ahora).anio ? `${dd}/${mm}` : `${dd}/${mm}/${anio}`;
  return `${fecha} · ${hora}`;
}

/**
 * Fecha y hora completas "18/06/2026 · 22:38". Para PDFs y paneles de auditoría,
 * donde "Hoy" no sirve: el documento se lee semanas después de generarse.
 */
export function formatFechaHora(iso: string): string {
  const { anio, mes, dia } = partesZona(new Date(iso));
  const dd = String(dia).padStart(2, "0");
  const mm = String(mes).padStart(2, "0");
  return `${dd}/${mm}/${anio} · ${formatHora(iso)}`;
}

/**
 * "YYYY-MM-DD HH:mm" en la zona clínica. Formato de hoja de cálculo: ordena
 * bien como texto y no obliga a Excel a adivinar el orden de día y mes.
 */
export function formatFechaHoraTabular(iso: string): string {
  return `${claveDiaZona(new Date(iso))} ${formatHora(iso)}`;
}
