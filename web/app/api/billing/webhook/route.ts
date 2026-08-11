import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, stripeEnabled } from "@/lib/billing/stripe";
import { recordBillingEvent } from "@/lib/billing/admin";
import { syncSubscriptionById } from "@/lib/billing/sync";
import { reportError } from "@/lib/observability";

export const runtime = "nodejs";

/**
 * Webhook de Stripe. Reglas de la casa:
 *
 * 1. FIRMA PRIMERO: no se lee ni un byte del payload sin verificar
 *    stripe-signature contra STRIPE_WEBHOOK_SECRET. Esta ruta está fuera del
 *    proxy y abierta a internet — la firma es la única puerta.
 * 2. IDEMPOTENCIA: cada evento se anota en billing_events por su id; un
 *    duplicado (Stripe reintenta a propósito) responde 200 sin efectos.
 * 3. NUNCA SE CONFÍA EN EL PAYLOAD: del evento solo se toma el id de la
 *    suscripción; el estado se re-consulta fresco a Stripe (lib/billing/sync).
 *    Eventos fuera de orden se vuelven inofensivos.
 * 4. Errores → 500, para que Stripe reintente con backoff.
 *
 * Stripe NUNCA decide el acceso: aquí solo se sincroniza billing_accounts;
 * quien decide es private.org_has_access() en la base.
 */

function subscriptionIdFrom(event: Stripe.Event): string | null {
  const object = event.data.object as unknown as Record<string, unknown>;

  if (event.type.startsWith("customer.subscription.")) {
    return typeof object.id === "string" ? object.id : null;
  }

  if (event.type === "checkout.session.completed") {
    const sub = object.subscription;
    if (typeof sub === "string") return sub;
    if (sub && typeof sub === "object" && "id" in sub) return String((sub as { id: unknown }).id);
    return null;
  }

  if (event.type.startsWith("invoice.")) {
    // API clásica: invoice.subscription. API Basil: invoice.parent.subscription_details.
    const direct = object.subscription;
    if (typeof direct === "string") return direct;
    const parent = object.parent as
      | { subscription_details?: { subscription?: unknown } }
      | undefined;
    const nested = parent?.subscription_details?.subscription;
    if (typeof nested === "string") return nested;
    return null;
  }

  return null;
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeEnabled() || !secret) {
    return NextResponse.json({ error: "Stripe no está configurado." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Falta la firma." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = await getStripe().webhooks.constructEventAsync(body, signature, secret);
  } catch (e) {
    reportError(e, { where: "billing-webhook:firma" });
    return NextResponse.json({ error: "Firma inválida." }, { status: 400 });
  }

  const relevant = new Set([
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
    "invoice.payment_failed",
  ]);
  if (!relevant.has(event.type)) {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  try {
    const subscriptionId = subscriptionIdFrom(event);

    // Resumen mínimo, no el payload entero: el ledger es para auditar qué
    // llegó y cuándo, no para almacenar objetos de Stripe.
    const object = event.data.object as unknown as { id?: unknown; status?: unknown };
    const fresh = await recordBillingEvent({
      stripeEventId: event.id,
      type: event.type,
      organizationId: null,
      payload: {
        object_id: typeof object.id === "string" ? object.id : null,
        object_status: typeof object.status === "string" ? object.status : null,
        subscription_id: subscriptionId,
      },
    });
    if (!fresh) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (subscriptionId) {
      await syncSubscriptionById(subscriptionId);
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    reportError(e, { where: "billing-webhook", type: event.type });
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
