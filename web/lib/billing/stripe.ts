import "server-only";

import Stripe from "stripe";

/**
 * SDK de Stripe, solo servidor. No hay JS de Stripe en el navegador: el
 * checkout y el portal son páginas HOSTED de Stripe (redirects), así que
 * ninguna tarjeta toca Miracle y el presupuesto de bundle no se entera.
 *
 * Sin STRIPE_SECRET_KEY la app degrada con gracia (mismo criterio que la IA
 * sin ANTHROPIC_API_KEY): la página de suscripción explica que los pagos aún
 * no están configurados y el trial/cortesía siguen gobernando el acceso.
 */

let cached: Stripe | null = null;

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY no está configurada.");
  cached ??= new Stripe(key);
  return cached;
}

/** Price mensual del plan B2C (lib/billing/plans.ts describe qué incluye). */
export function proPriceId(): string | null {
  return process.env.STRIPE_PRICE_ID_PRO ?? null;
}
