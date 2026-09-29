"use client";

import type { PrivacyShieldSummary } from "@/lib/api/clinical";
import { describePrivacySummary } from "@/lib/clinical/privacy-summary";
import { PrivacyShieldIcon } from "./privacy-icon";

/**
 * Insignia de privacidad. Solo afirma lo que el servidor certificó para esta
 * consulta (ver lib/clinical/privacy-summary.ts); sin dato, no afirma nada.
 */
export function PrivacyShieldBadge({
  privacy,
  className = "",
}: {
  privacy: PrivacyShieldSummary | null | undefined;
  className?: string;
}) {
  const { tone, label } = describePrivacySummary(privacy);
  const styles =
    tone === "success"
      ? "bg-success-soft text-success"
      : tone === "warning"
        ? "bg-warning-soft text-warning"
        : "bg-ice-soft text-muted";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${styles} ${className}`}
      title={describePrivacySummary(privacy).detail}
    >
      <PrivacyShieldIcon tone={tone} size={13} className="shrink-0" />
      {label}
    </span>
  );
}
