import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, CreditCard, Lock, RefreshCw } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/server";
import { PLAN, TRIAL_DIAS, precioDisplay } from "@/lib/billing/plans";
import { stripeEnabled } from "@/lib/billing/stripe";
import { syncCheckoutSession } from "@/lib/billing/sync";
import { reportError } from "@/lib/observability";
import { FlashBanner } from "@/components/superadmin/FlashBanner";
import { SubmitButton } from "@/app/login/SubmitButton";
import { createCheckoutSession, createPortalSession, refreshFromStripe } from "./actions";

const FLASH_ERROR: Record<string, string> = {
  "pagos-no-configurados":
    "Los pagos en línea aún no están configurados. Escríbenos y lo resolvemos contigo.",
  "checkout-fallo": "No pudimos iniciar el pago. Intenta de nuevo en un momento.",
  "portal-fallo": "No pudimos abrir el portal de pagos. Intenta de nuevo en un momento.",
  "sin-cliente-stripe": "Esta cuenta todavía no tiene pagos registrados.",
  "sync-fallo": "No pudimos consultar a Stripe. Intenta de nuevo en un momento.",
};

const FLASH_OK: Record<string, string> = {
  "estado-actualizado": "Estado de la suscripción actualizado.",
};

const BTN_PRIMARY =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-night px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto";
const BTN_SECONDARY =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-line bg-surface px-6 text-sm font-semibold text-deep transition-colors hover:bg-ice-soft disabled:opacity-60 sm:w-auto";

function PlanCard() {
  return (
    <section className="rounded-[14px] border border-line bg-surface p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-deep">{PLAN.nombre}</h2>
        <p className="text-sm font-semibold text-deep">{precioDisplay()}</p>
      </div>
      <ul className="mt-4 space-y-2">
        {PLAN.incluye.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-ink-soft">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function SuscripcionPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; session_id?: string; ok?: string; error?: string }>;
}) {
  const params = await searchParams;

  let profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/suscripcion");
  if (profile.role === "superadmin") redirect("/superadmin");

  // Retorno del checkout: sincronizar ANTES de leer el estado, para que el
  // médico vea "activa" sin esperar la carrera del webhook.
  let checkoutOk = false;
  if (
    params.checkout === "success" &&
    params.session_id &&
    stripeEnabled() &&
    profile.orgKind === "personal" &&
    profile.organizationId
  ) {
    try {
      checkoutOk = await syncCheckoutSession(params.session_id, profile.organizationId);
      profile = (await getCurrentProfile()) ?? profile;
    } catch (e) {
      reportError(e, { where: "suscripcion:sync-checkout" });
    }
  }

  const billing = profile.billing;
  const blocked = billing.level === "blocked";

  // Un hospital no gestiona pagos aquí: paga la institución.
  if (profile.orgKind !== "personal") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-deep">Suscripción</h1>
        <section className="rounded-[14px] border border-line bg-surface p-6 text-sm text-ink-soft">
          El acceso de tu cuenta está cubierto por{" "}
          <strong className="text-deep">tu institución</strong>. No tienes nada que pagar por aquí:
          cualquier novedad sobre el servicio la gestiona la administración de tu organización con
          Miracle.
        </section>
        <Link
          href="/app/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-accent-ink hover:underline"
        >
          <ArrowLeft size={16} /> Volver al panel
        </Link>
      </div>
    );
  }

  const titulo: Record<string, string> = {
    trial: "Prueba gratuita activa",
    activa: "Suscripción activa",
    pago_pendiente: "Tu último pago falló",
    cancelada: "Suscripción cancelada",
    sin_plan: "Tu prueba gratuita terminó",
    cortesia: "Cuenta de cortesía",
    sin_registro: "Suscripción",
  };

  const flashError = params.error ? FLASH_ERROR[params.error] ?? "Algo salió mal." : undefined;
  const flashOk = checkoutOk
    ? "Pago recibido: tu suscripción quedó activa. Bienvenido."
    : params.checkout === "cancelled"
      ? undefined
      : params.ok
        ? FLASH_OK[params.ok]
        : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-deep">
          {titulo[billing.status] ?? "Suscripción"}
        </h1>
        {!blocked ? (
          <Link
            href="/app/dashboard"
            className="inline-flex items-center gap-2 text-sm font-semibold text-accent-ink hover:underline"
          >
            <ArrowLeft size={16} /> Volver al panel
          </Link>
        ) : null}
      </div>

      <FlashBanner ok={flashOk} error={flashError} />
      {params.checkout === "cancelled" ? (
        <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
          No se realizó ningún cobro. Puedes intentarlo cuando quieras.
        </p>
      ) : null}

      {blocked ? (
        <section className="flex items-start gap-3 rounded-[14px] border border-warning/40 bg-warning-soft p-5">
          <Lock size={20} className="mt-0.5 shrink-0 text-warning" />
          <div className="text-sm text-deep">
            <p className="font-semibold">Tu acceso a Miracle Notes está inactivo.</p>
            <p className="mt-1 text-ink-soft">
              {billing.status === "pago_pendiente"
                ? "El cobro de tu suscripción no pudo procesarse. Actualiza tu método de pago para recuperar el acceso de inmediato."
                : billing.status === "cancelada"
                  ? "Tu suscripción fue cancelada. Reactívala para volver a usar Miracle Notes."
                  : `Los ${TRIAL_DIAS} días de prueba terminaron. Elige tu plan para seguir documentando consultas.`}{" "}
              Tu historia clínica está intacta y reaparece completa al reactivar.
            </p>
          </div>
        </section>
      ) : null}

      {billing.status === "trial" ? (
        <p className="text-sm text-ink-soft">
          Te {billing.trialDaysLeft === 1 ? "queda" : "quedan"}{" "}
          <strong className="text-deep">
            {billing.trialDaysLeft ?? 0} {billing.trialDaysLeft === 1 ? "día" : "días"}
          </strong>{" "}
          de prueba con el producto completo. Suscríbete cuando quieras: el cobro empieza al
          suscribirte, no antes.
        </p>
      ) : null}

      {billing.status === "cortesia" ? (
        <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
          Tu cuenta tiene acceso por cortesía de Miracle. No necesitas configurar pagos.
        </p>
      ) : null}

      {billing.status === "activa" ? (
        <section className="rounded-[14px] border border-line bg-surface p-6 text-sm text-ink-soft">
          <p>
            Plan <strong className="text-deep">{PLAN.nombre}</strong>
            {billing.periodEnd ? (
              <>
                {" · "}
                {billing.cancelAtPeriodEnd ? "activo hasta el " : "se renueva el "}
                <strong className="text-deep">
                  {new Date(billing.periodEnd).toLocaleDateString("es-CO", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "America/Bogota",
                  })}
                </strong>
              </>
            ) : null}
            .
          </p>
          {billing.cancelAtPeriodEnd ? (
            <p className="mt-2">
              La cancelación está programada. Puedes reactivarla desde el portal de pagos antes de
              esa fecha.
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Qué incluye el plan: se muestra siempre que haya algo que contratar. */}
      {billing.status !== "cortesia" && billing.status !== "activa" ? <PlanCard /> : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        {billing.status === "trial" ||
        billing.status === "sin_plan" ||
        billing.status === "cancelada" ||
        billing.status === "sin_registro" ? (
          <form action={createCheckoutSession} className="w-full sm:w-auto">
            <SubmitButton pendingLabel="Abriendo pago seguro…" className={BTN_PRIMARY}>
              <CreditCard size={16} />
              {billing.status === "cancelada" ? "Reactivar suscripción" : "Suscribirme"}
            </SubmitButton>
          </form>
        ) : null}

        {billing.status === "pago_pendiente" || billing.status === "activa" ? (
          <form action={createPortalSession} className="w-full sm:w-auto">
            <SubmitButton
              pendingLabel="Abriendo portal…"
              className={billing.status === "pago_pendiente" ? BTN_PRIMARY : BTN_SECONDARY}
            >
              <CreditCard size={16} />
              {billing.status === "pago_pendiente" ? "Arreglar pago" : "Gestionar suscripción"}
            </SubmitButton>
          </form>
        ) : null}

        {billing.status === "activa" || billing.status === "pago_pendiente" ? (
          <form action={refreshFromStripe} className="w-full sm:w-auto">
            <SubmitButton pendingLabel="Consultando…" className={BTN_SECONDARY}>
              <RefreshCw size={15} /> Actualizar estado
            </SubmitButton>
          </form>
        ) : null}
      </div>

      <p className="text-xs text-muted">
        El pago se procesa en una página segura de Stripe; Miracle nunca ve tu tarjeta. ¿Dudas?{" "}
        <a className="underline" href="mailto:dev@itsmiracleai.com">
          Escríbenos
        </a>
        .
      </p>
    </div>
  );
}
