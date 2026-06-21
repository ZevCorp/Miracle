/**
 * Constantes compartidas del sitio Miracle.
 * Centraliza navegación, contacto y CTAs para mantener consistencia.
 */

export const SITE = {
  name: "Miracle",
  tagline: "Inteligencia clínica-operativa para hospitales",
  // Número usado en el sitio previo para conversión (WhatsApp).
  whatsappNumber: "573172550953",
  email: "hola@miracle.health",
} as const;

export const WHATSAPP_BASE = `https://wa.me/${SITE.whatsappNumber}`;

/** Genera un enlace de WhatsApp con mensaje prellenado. */
export function whatsappLink(message: string): string {
  return `${WHATSAPP_BASE}?text=${encodeURIComponent(message)}`;
}

export const CTA = {
  primary: { label: "Solicitar piloto", href: "/piloto" },
  secondary: { label: "Ver demo", href: "/demo" },
} as const;

/** Navegación del sitio público. */
export const marketingNav = [
  { label: "Cómo funciona", href: "/como-funciona" },
  { label: "Seguridad", href: "/seguridad" },
  { label: "Casos de uso", href: "/casos-de-uso" },
  { label: "Piloto", href: "/piloto" },
  { label: "Recursos", href: "/recursos" },
] as const;

/** Navegación de la app privada (futura). Iconos resueltos en AppSidebar. */
export const appNav = [
  { label: "Inicio", href: "/app/dashboard", icon: "dashboard" },
  { label: "Consultas", href: "/app/consultas", icon: "consultas" },
  { label: "Pacientes", href: "/app/pacientes", icon: "pacientes" },
  { label: "Notas", href: "/app/notas", icon: "notas" },
  { label: "Auditoría", href: "/app/auditoria", icon: "auditoria" },
  { label: "Reportes", href: "/app/reportes", icon: "reportes" },
  { label: "Plantillas", href: "/app/plantillas", icon: "plantillas" },
  { label: "Configuración", href: "/app/configuracion", icon: "configuracion" },
  { label: "Usuarios", href: "/app/usuarios", icon: "usuarios" },
] as const;
