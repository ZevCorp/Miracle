/**
 * Derivación del acceso comercial. ESPEJO de `private.org_has_access()`
 * (supabase/migrations/20260811100000_billing_accounts.sql): mismos casos,
 * mismos resultados. Si cambias algo aquí, cámbialo allá — los tests de
 * tests/billing-entitlements.test.ts cubren la matriz completa.
 *
 * La base es la autoridad (RLS restrictiva "billing access gate"); esta copia
 * existe para que el servidor decida redirects y la interfaz pinte estados sin
 * un viaje extra por navegación.
 */

export type BillingMode = "self_serve" | "institutional" | "comped";

export type StripeStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

/** Fila de billing_accounts tal como la devuelve el embed de PostgREST. */
export interface BillingAccountRow {
  mode: BillingMode;
  stripe_status: StripeStatus | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
  comped_until: string | null;
}

/**
 * Estado con palabras del negocio, para banners y la página de suscripción.
 * `sin_registro` = organización sin fila de billing: acceso abierto (fail-open
 * deliberado, ver la migración) y ningún banner.
 */
export type BillingStatus =
  | "trial"
  | "activa"
  | "pago_pendiente"
  | "cancelada"
  | "sin_plan"
  | "cortesia"
  | "institucional"
  | "sin_registro";

export interface BillingAccess {
  level: "full" | "blocked";
  status: BillingStatus;
  /** Días de prueba restantes (solo en status "trial"; redondeado hacia arriba). */
  trialDaysLeft: number | null;
  /** true si la suscripción sigue activa pero morirá al final del período. */
  cancelAtPeriodEnd: boolean;
  /** Fin del período pagado (ISO), si Stripe lo reportó. */
  periodEnd: string | null;
}

/** Espejo de private.billing_grace_days(): 0 = un pago fallido bloquea ya. */
export const GRACE_DAYS = 0;

const DAY_MS = 86_400_000;

function accessOf(
  level: BillingAccess["level"],
  status: BillingStatus,
  extra?: Partial<BillingAccess>,
): BillingAccess {
  return {
    level,
    status,
    trialDaysLeft: null,
    cancelAtPeriodEnd: false,
    periodEnd: null,
    ...extra,
  };
}

export function deriveAccess(
  row: BillingAccountRow | null,
  orgKind: "personal" | "institution" | null,
  archivedAt: string | null,
  now: Date = new Date(),
): BillingAccess {
  // Corte institucional existente (D11): una org archivada no entra. En la
  // práctica getCurrentProfile ya expulsó a estos usuarios; el caso queda por
  // completitud del espejo.
  if (archivedAt) return accessOf("blocked", orgKind === "institution" ? "institucional" : "sin_plan");

  if (!row) {
    // Fail-open documentado: sin fila de billing no se bloquea a nadie.
    return accessOf("full", orgKind === "institution" ? "institucional" : "sin_registro");
  }

  if (row.mode === "institutional") return accessOf("full", "institucional");

  // La cortesía es un overlay: vencida, la cuenta se evalúa como self_serve
  // (así un comped vencido que se suscribe queda activo sin más).
  if (row.mode === "comped") {
    const vigente = row.comped_until === null || new Date(row.comped_until) > now;
    if (vigente) return accessOf("full", "cortesia");
  }

  if (row.stripe_status === "active" || row.stripe_status === "trialing") {
    return accessOf("full", "activa", {
      cancelAtPeriodEnd: row.cancel_at_period_end,
      periodEnd: row.current_period_end,
    });
  }

  if (row.stripe_status === "past_due") {
    const limite =
      (row.current_period_end ? new Date(row.current_period_end).getTime() : now.getTime()) +
      GRACE_DAYS * DAY_MS;
    return accessOf(now.getTime() < limite ? "full" : "blocked", "pago_pendiente", {
      periodEnd: row.current_period_end,
    });
  }

  if (row.stripe_status === null) {
    // Nunca hubo suscripción: manda el trial de Miracle.
    if (row.trial_ends_at && new Date(row.trial_ends_at) > now) {
      return accessOf("full", "trial", {
        trialDaysLeft: Math.ceil((new Date(row.trial_ends_at).getTime() - now.getTime()) / DAY_MS),
      });
    }
    return accessOf("blocked", "sin_plan");
  }

  if (row.stripe_status === "canceled") return accessOf("blocked", "cancelada");

  // unpaid / paused / incomplete / incomplete_expired.
  return accessOf("blocked", "sin_plan");
}
