// Formato de fechas para la UI, con la fecha REAL local del dispositivo.
//
// Reemplaza a los helpers de lib/mock que comparaban contra una constante fija
// (MOCK_TODAY): con datos reales, "hoy" siempre daba falso y el conteo del
// dashboard quedaba en 0. Aquí el día y la hora se derivan del MISMO `Date`
// (nunca `iso.slice(0,10)`, que toma el día en UTC y se desfasa respecto a la
// hora mostrada en local).

/** Clave "YYYY-MM-DD" del día LOCAL de un Date. */
function localDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Medianoche local de un Date (para diferencias en días de calendario). */
function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Hora "HH:mm" (24h) de una fecha ISO, en la zona local. */
export function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** true si el ISO cae hoy (día de calendario local). */
export function esDeHoy(iso: string): boolean {
  return localDateKey(new Date(iso)) === localDateKey(new Date());
}

/**
 * Etiqueta relativa: "Hoy · 14:30", "Ayer · 10:20", "18/06 · 22:38", y
 * "18/06/2025 · 22:38" cuando el año difiere del actual (evita ambigüedad con
 * más de un año de historia).
 */
export function formatFechaRelativa(iso: string): string {
  const target = new Date(iso);
  const now = new Date();
  const diffDias = Math.round(
    (startOfLocalDay(now) - startOfLocalDay(target)) / 86_400_000,
  );
  const hora = formatHora(iso);
  if (diffDias === 0) return `Hoy · ${hora}`;
  if (diffDias === 1) return `Ayer · ${hora}`;
  const dd = String(target.getDate()).padStart(2, "0");
  const mm = String(target.getMonth() + 1).padStart(2, "0");
  const fecha =
    target.getFullYear() === now.getFullYear()
      ? `${dd}/${mm}`
      : `${dd}/${mm}/${target.getFullYear()}`;
  return `${fecha} · ${hora}`;
}
