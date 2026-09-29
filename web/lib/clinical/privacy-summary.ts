/**
 * Lo que la pantalla puede AFIRMAR sobre la protección de datos hacia la IA.
 *
 * Hasta el 2026-09-07 la insignia «Datos del paciente protegidos antes de
 * enviar a la IA» salía de un redactor del navegador que llevaba apagado
 * desde julio: afirmaba una protección que no existía. Ahora la protección
 * ocurre en el servidor (Graph, en el último salto antes del proveedor) y es
 * el servidor quien dice qué tapó, llamada por llamada. Esta función es el
 * único sitio que traduce ese dato a texto, y su regla es una sola: **sin
 * dato del servidor no se afirma nada.**
 *
 * Ver docs/privacidad-frontera-ia.md y, en Graph, docs/privacy-egress-gateway.md.
 */

import type { PrivacyLedgerEvent, PrivacyShieldSummary } from "@/lib/api/clinical";

export type PrivacyTone = "success" | "warning" | "muted";

export interface PrivacyDescription {
  tone: PrivacyTone;
  /** Texto corto para la insignia. */
  label: string;
  /** Texto largo para el panel de auditoría. */
  detail: string;
}

const TYPE_LABELS: Record<string, [string, string]> = {
  PACIENTE_NOMBRE: ["nombre", "nombres"],
  DOCUMENTO: ["documento", "documentos"],
  TELEFONO: ["teléfono", "teléfonos"],
  CORREO: ["correo", "correos"],
  DIRECCION: ["dirección", "direcciones"],
  NUMERO: ["número", "números"],
};

/** «1 nombre, 2 documentos, 1 teléfono» a partir de los conteos por tipo. */
export function describePrivacyTokens(tokens: Record<string, number> | undefined): string {
  const parts: string[] = [];
  for (const [type, [singular, plural]] of Object.entries(TYPE_LABELS)) {
    const count = Number(tokens?.[type] ?? 0);
    if (count > 0) parts.push(`${count} ${count === 1 ? singular : plural}`);
  }
  return parts.join(", ");
}

export function describePrivacySummary(
  privacy: PrivacyShieldSummary | null | undefined,
): PrivacyDescription {
  if (!privacy) {
    return {
      tone: "muted",
      label: "La protección hacia la IA se certifica al generar la nota",
      detail:
        "Todavía no hay un envío a la IA registrado para esta consulta. Cuando lo haya, aquí se verá qué datos protegió el servidor antes de enviarlo.",
    };
  }
  if (privacy.mode !== "enforce" || !privacy.shielded) {
    return {
      tone: "warning",
      label:
        privacy.mode === "shadow"
          ? "Sin protección activa (modo sombra)"
          : "Sin protección activa",
      detail:
        privacy.mode === "shadow"
          ? "El servidor está en modo sombra: detecta y anota qué taparía, pero el texto salió tal cual hacia la IA."
          : "El servidor no está tapando datos del paciente en los envíos a la IA.",
    };
  }
  const counts = describePrivacyTokens(privacy.tokens);
  const issues: string[] = [];
  if (privacy.rehydration === "incomplete") {
    issues.push("un marcador no se pudo resolver; revisa la nota");
  }
  if (privacy.leak_scan === "repaired") {
    issues.push("el barrido tuvo que reparar un dato antes de enviarlo");
  }
  if (privacy.posthoc_leak) {
    issues.push("la IA devolvió un dato real en la identificación");
  }
  return {
    tone: issues.length > 0 ? "warning" : "success",
    label: counts
      ? `Protegido antes de enviar a la IA: ${counts}`
      : "Enviado a la IA sin identificadores que tapar",
    detail:
      (counts
        ? `Antes de salir hacia la IA, el servidor reemplazó ${counts} del paciente por marcadores y devolvió los datos reales al recibir la respuesta.`
        : "El servidor no encontró identificadores directos del paciente en lo que salió hacia la IA.") +
      (issues.length > 0 ? ` Atención: ${issues.join("; ")}.` : ""),
  };
}

/**
 * De los envíos registrados de una consulta, el que describe la NOTA: el último
 * de generación. Si no hay, el último con dato de privacidad.
 */
export function privacyFromLedgerEvents(
  events: PrivacyLedgerEvent[] | null | undefined,
): PrivacyShieldSummary | null {
  const list = Array.isArray(events) ? events : [];
  const generation = list.find((event) => event.feature === "note_generation" && event.privacy);
  const any = list.find((event) => event.privacy);
  return generation?.privacy ?? any?.privacy ?? null;
}
