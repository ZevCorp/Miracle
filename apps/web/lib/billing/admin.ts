import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Escritura privilegiada de billing (decisión D15).
 *
 * El webhook de Stripe llega SIN sesión de usuario, así que necesita una
 * credencial capaz de escribir billing_accounts/billing_events (que no tienen
 * grants para authenticated). Esa credencial —SUPABASE_SECRET_KEY— vive
 * confinada en este módulo: el cliente NO se exporta y las funciones que sí,
 * solo tocan tablas billing_*. La invariante del proyecto pasa de "sin
 * credencial privilegiada" a "sin credencial privilegiada en el camino de los
 * datos clínicos", que es lo que siempre protegió.
 */

let cached: SupabaseClient | null = null;

function adminDb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SECRET_KEY no está configurada (necesaria para sincronizar billing).");
  }
  cached ??= createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export interface BillingAccountState {
  organization_id: string;
  mode: "self_serve" | "institutional" | "comped";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
}

/** Fila actual de billing de una organización (o null si no existe). */
export async function getBillingRow(organizationId: string): Promise<BillingAccountState | null> {
  const { data, error } = await adminDb()
    .from("billing_accounts")
    .select(
      "organization_id, mode, stripe_customer_id, stripe_subscription_id, stripe_status, current_period_end, cancel_at_period_end, trial_ends_at",
    )
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer billing_accounts: ${error.message}`);
  return (data as BillingAccountState | null) ?? null;
}

/**
 * Registra un evento de Stripe. Devuelve false si ya se había aplicado
 * (idempotencia por stripe_event_id — Stripe reintenta y duplica a propósito).
 */
export async function recordBillingEvent(event: {
  stripeEventId: string;
  type: string;
  organizationId: string | null;
  payload: Record<string, unknown>;
}): Promise<boolean> {
  const { error } = await adminDb().from("billing_events").insert({
    stripe_event_id: event.stripeEventId,
    type: event.type,
    organization_id: event.organizationId,
    payload: event.payload,
  });
  if (error) {
    // 23505 = unique_violation sobre stripe_event_id: evento ya aplicado.
    if (error.code === "23505") return false;
    throw new Error(`No se pudo registrar el evento de billing: ${error.message}`);
  }
  return true;
}

/** ¿A qué organización pertenece este customer de Stripe? */
export async function findOrgByStripeCustomer(customerId: string): Promise<string | null> {
  const { data, error } = await adminDb()
    .from("billing_accounts")
    .select("organization_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) throw new Error(`No se pudo buscar el customer de Stripe: ${error.message}`);
  return data?.organization_id ?? null;
}

/** Ata el customer de Stripe a la organización (antes del primer checkout). */
export async function setStripeCustomer(organizationId: string, customerId: string): Promise<void> {
  const { error } = await adminDb()
    .from("billing_accounts")
    .update({ stripe_customer_id: customerId })
    .eq("organization_id", organizationId);
  if (error) throw new Error(`No se pudo guardar el customer de Stripe: ${error.message}`);
}

/**
 * Aplica el estado FRESCO de una suscripción de Stripe a la cuenta de la
 * organización. Nunca pisa una cuenta institucional: si un hospital terminara
 * con una suscripción de Stripe por error, el modo institucional (y su
 * acceso) se preservan y el caso queda a la vista en billing_events.
 */
export async function applySubscriptionState(
  organizationId: string,
  sub: {
    id: string;
    customerId: string | null;
    status: string;
    priceId: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  },
): Promise<void> {
  const existing = await getBillingRow(organizationId);
  const keepInstitutional = existing?.mode === "institutional";

  const fields = {
    organization_id: organizationId,
    mode: keepInstitutional ? "institutional" : "self_serve",
    stripe_customer_id: sub.customerId ?? existing?.stripe_customer_id ?? null,
    stripe_subscription_id: sub.id,
    stripe_status: sub.status,
    stripe_price_id: sub.priceId,
    current_period_end: sub.currentPeriodEnd,
    cancel_at_period_end: sub.cancelAtPeriodEnd,
    last_stripe_event_at: new Date().toISOString(),
  };

  const { error } = await adminDb()
    .from("billing_accounts")
    .upsert(fields, { onConflict: "organization_id" });
  if (error) throw new Error(`No se pudo aplicar el estado de la suscripción: ${error.message}`);
}
