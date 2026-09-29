import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import type { PrivacyTone } from "@/lib/clinical/privacy-summary";

/**
 * El icono dice lo mismo que el texto. El escudo con visto solo aparece cuando
 * el servidor certificó la protección; en modo sombra lleva alerta, y sin dato
 * es un escudo vacío. Hasta el 2026-09-26 el panel de auditoría pintaba
 * SIEMPRE el visto verde, también junto a «Sin protección activa».
 */
export function PrivacyShieldIcon({
  tone,
  size = 15,
  className = "",
}: {
  tone: PrivacyTone;
  size?: number;
  className?: string;
}) {
  switch (tone) {
    case "success":
      return <ShieldCheck size={size} className={className} aria-hidden />;
    case "warning":
      return <ShieldAlert size={size} className={className} aria-hidden />;
    default:
      return <Shield size={size} className={className} aria-hidden />;
  }
}

const COLORES: Record<PrivacyTone, string> = {
  success: "text-success",
  warning: "text-warning",
  muted: "text-muted",
};

export function privacyIconColor(tone: PrivacyTone): string {
  return COLORES[tone];
}
