/**
 * Catálogo de planes B2C. En código y no en tabla: hay un plan, sin UI de
 * administración — una tabla añadiría migración, RLS y sincronización sin
 * beneficio. Si algún día hay planes por país o negociados, se promueve.
 *
 * El price ID de Stripe NO vive aquí (esto lo importan páginas de marketing):
 * lo lee lib/billing/stripe.ts de STRIPE_PRICE_ID_PRO, solo en servidor.
 */

export const TRIAL_DIAS = 14;

export const PLAN = {
  id: "notes-pro",
  nombre: "Miracle Notes",
  moneda: "COP",
  /**
   * Precio mensual en pesos. `null` = aún sin decisión comercial: la página de
   * precios muestra "por confirmar" y el checkout usa el precio del Price de
   * Stripe (la autoridad del monto SIEMPRE es Stripe; este número es display).
   */
  precioMensualCop: null as number | null,
  periodo: "mes",
  incluye: [
    "Consultas ilimitadas con grabación en vivo",
    "Nota clínica estructurada con IA y firma electrónica",
    "Codificación CIE-10 y CUPS sugerida",
    "Plantillas por especialidad (49 especialidades)",
    "Agenda del día e importación desde foto",
    "Exportación a PDF lista para su historia clínica",
  ],
} as const;

/** "$ 149.900 COP/mes" o el texto de por confirmar. */
export function precioDisplay(): string {
  if (PLAN.precioMensualCop === null) return "Precio de lanzamiento por confirmar";
  return `$ ${PLAN.precioMensualCop.toLocaleString("es-CO")} ${PLAN.moneda}/${PLAN.periodo}`;
}
