"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentProfile, type AuthenticatedProfile } from "@/lib/auth/server";
import { getStripe, proPriceId, stripeEnabled } from "@/lib/billing/stripe";
import { getBillingRow, setStripeCustomer } from "@/lib/billing/admin";
import { refreshOrgFromStripe } from "@/lib/billing/sync";
import { reportError } from "@/lib/observability";

/**
 * Acciones de la página de suscripción (solo organizaciones personales, B2C).
 * Checkout y portal son páginas HOSTED de Stripe: aquí solo se crean las
 * sesiones y se redirige — ninguna tarjeta pasa por Miracle.
 */

async function appUrl() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  if (origin) return origin.replace(/\/$/, "");

  const forwardedHost = requestHeaders.get("x-forwarded-host");
  if (forwardedHost) {
    const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
    return `${protocol}://${forwardedHost}`;
  }

  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100").replace(/\/$/, "");
}

/**
 * Solo el titular de una organización personal gestiona pagos: ni cuentas
 * demo, ni miembros de hospital (ahí paga la institución), ni superadmin.
 */
async function requirePersonalOwner(): Promise<AuthenticatedProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/suscripcion");
  if (profile.isDemo || profile.orgKind !== "personal" || !profile.organizationId) {
    redirect("/suscripcion");
  }
  return profile;
}

export async function createCheckoutSession() {
  const profile = await requirePersonalOwner();

  const priceId = proPriceId();
  if (!stripeEnabled() || !priceId) {
    redirect("/suscripcion?error=pagos-no-configurados");
  }

  const organizationId = profile.organizationId!;
  let checkoutUrl: string | null = null;

  try {
    const stripe = getStripe();

    // Un customer por organización, creado la primera vez y reutilizado:
    // así todo el historial de pagos queda bajo el mismo cliente en Stripe.
    const row = await getBillingRow(organizationId);
    let customerId = row?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email,
        name: profile.fullName ?? undefined,
        metadata: { organization_id: organizationId },
      });
      customerId = customer.id;
      await setStripeCustomer(organizationId, customerId);
    }

    const base = await appUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: organizationId,
      subscription_data: { metadata: { organization_id: organizationId } },
      allow_promotion_codes: true,
      success_url: `${base}/suscripcion?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/suscripcion?checkout=cancelled`,
    });

    checkoutUrl = session.url;
  } catch (e) {
    reportError(e, { where: "createCheckoutSession" });
    redirect("/suscripcion?error=checkout-fallo");
  }

  if (!checkoutUrl) {
    redirect("/suscripcion?error=checkout-fallo");
  }
  redirect(checkoutUrl);
}

export async function createPortalSession() {
  const profile = await requirePersonalOwner();

  if (!stripeEnabled()) {
    redirect("/suscripcion?error=pagos-no-configurados");
  }

  const row = await getBillingRow(profile.organizationId!);
  if (!row?.stripe_customer_id) {
    redirect("/suscripcion?error=sin-cliente-stripe");
  }

  let portalUrl: string | null = null;
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: `${await appUrl()}/suscripcion`,
    });
    portalUrl = session.url;
  } catch (e) {
    reportError(e, { where: "createPortalSession" });
    redirect("/suscripcion?error=portal-fallo");
  }

  if (!portalUrl) {
    redirect("/suscripcion?error=portal-fallo");
  }
  redirect(portalUrl);
}

export async function refreshFromStripe() {
  const profile = await requirePersonalOwner();

  if (!stripeEnabled()) {
    redirect("/suscripcion?error=pagos-no-configurados");
  }

  try {
    await refreshOrgFromStripe(profile.organizationId!);
  } catch (e) {
    reportError(e, { where: "refreshFromStripe" });
    redirect("/suscripcion?error=sync-fallo");
  }

  revalidatePath("/suscripcion");
  redirect("/suscripcion?ok=estado-actualizado");
}
