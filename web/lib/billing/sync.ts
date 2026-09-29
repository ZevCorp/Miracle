import "server-only";

import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
import {
  applySubscriptionState,
  findOrgByStripeCustomer,
  getBillingRow,
} from "@/lib/billing/admin";

/**
 * Sincronización Stripe → billing_accounts. Una sola regla para el webhook,
 * el retorno del checkout y el botón "Actualizar estado": NUNCA se confía en
 * un payload que llegó por la red — se re-consulta la suscripción a Stripe y
 * se aplica ese estado fresco. Así los eventos duplicados o fuera de orden
 * son inofensivos: aplicar dos veces el estado actual es idempotente.
 */

/** `current_period_end` vive en la Subscription (APIs viejas) o en sus items (Basil). */
function periodEndOf(sub: Stripe.Subscription): string | null {
  const direct = (sub as unknown as { current_period_end?: unknown }).current_period_end;
  const fromItem = (sub.items?.data?.[0] as unknown as { current_period_end?: unknown } | undefined)
    ?.current_period_end;
  const unix = typeof direct === "number" ? direct : typeof fromItem === "number" ? fromItem : null;
  return unix ? new Date(unix * 1000).toISOString() : null;
}

function customerIdOf(sub: Stripe.Subscription): string | null {
  return typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
}

/** La organización dueña: metadata primero, customer como respaldo. */
async function resolveOrg(sub: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = sub.metadata?.organization_id;
  if (typeof fromMetadata === "string" && fromMetadata) return fromMetadata;
  const customerId = customerIdOf(sub);
  return customerId ? await findOrgByStripeCustomer(customerId) : null;
}

/** Trae la suscripción fresca de Stripe y la aplica. Devuelve la org afectada. */
export async function syncSubscriptionById(subscriptionId: string): Promise<string | null> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const organizationId = await resolveOrg(sub);
  if (!organizationId) return null;

  await applySubscriptionState(organizationId, {
    id: sub.id,
    customerId: customerIdOf(sub),
    status: sub.status,
    priceId: sub.items?.data?.[0]?.price?.id ?? null,
    currentPeriodEnd: periodEndOf(sub),
    cancelAtPeriodEnd: sub.cancel_at_period_end === true,
  });
  return organizationId;
}

/**
 * Retorno del checkout: el usuario vuelve con ?session_id= antes de que el
 * webhook llegue. Se sincroniza en el momento para que vea "activa" ya.
 * `expectedOrgId` ata la sesión a la organización del usuario que volvió.
 */
export async function syncCheckoutSession(
  sessionId: string,
  expectedOrgId: string,
): Promise<boolean> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.client_reference_id && session.client_reference_id !== expectedOrgId) {
    return false;
  }
  const subId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!subId) return false;
  const org = await syncSubscriptionById(subId);
  return org === expectedOrgId;
}

/** Botón "Actualizar estado" y reconciliación: pull on-demand para una org. */
export async function refreshOrgFromStripe(organizationId: string): Promise<boolean> {
  const row = await getBillingRow(organizationId);
  if (!row?.stripe_subscription_id) return false;
  const org = await syncSubscriptionById(row.stripe_subscription_id);
  return org !== null;
}
