"use client";

import Link from "next/link";
import { CreditCard } from "lucide-react";
import type { BillingAccess } from "@/lib/billing/entitlements";

function fechaCorta(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("es-CO", {
      day: "numeric",
      month: "long",
      timeZone: "America/Bogota",
    });
  } catch {
    return null;
  }
}

/**
 * Franja de estado comercial bajo el encabezado. Solo habla cuando hay algo
 * que decir: días de prueba restantes, un pago fallido en gracia o una
 * cancelación programada. Una suscripción sana no muestra nada.
 *
 * Los estados bloqueados no llegan aquí: el layout de /app redirige a
 * /suscripcion antes de montar el shell.
 */
export function BillingBanner({ billing }: { billing: BillingAccess }) {
  let texto: string | null = null;
  let cta = "Ver planes";
  let tono: "info" | "warning" = "info";

  if (billing.status === "trial") {
    const dias = billing.trialDaysLeft ?? 0;
    texto =
      dias <= 1
        ? "Tu prueba gratuita termina hoy."
        : `Prueba gratuita: te quedan ${dias} días.`;
    tono = dias <= 3 ? "warning" : "info";
    cta = "Elegir plan";
  } else if (billing.status === "pago_pendiente") {
    texto = "Tu último pago falló. Actualiza tu método de pago para no perder acceso.";
    tono = "warning";
    cta = "Arreglar pago";
  } else if (billing.status === "activa" && billing.cancelAtPeriodEnd) {
    const fecha = fechaCorta(billing.periodEnd);
    texto = fecha
      ? `Tu suscripción se cancelará el ${fecha}.`
      : "Tu suscripción se cancelará al final del período.";
    tono = "warning";
    cta = "Reactivar";
  }

  if (!texto) return null;

  return (
    <div
      role="status"
      className={`flex items-center justify-between gap-3 border-b border-line px-3 py-2 text-sm md:px-6 ${
        tono === "warning" ? "bg-warning-soft text-deep" : "bg-ice text-deep"
      }`}
    >
      <span className="min-w-0 truncate font-medium">{texto}</span>
      <Link
        href="/suscripcion"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-night px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
      >
        <CreditCard size={13} />
        {cta}
      </Link>
    </div>
  );
}
